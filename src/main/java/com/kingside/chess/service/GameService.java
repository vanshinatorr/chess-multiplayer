package com.kingside.chess.service;

import com.kingside.chess.manager.GameManager;
import com.kingside.chess.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import java.util.regex.Pattern;

/**
 * Core business logic service for chess gameplay, matchmaking, turn validation,
 * board state integrity verification, and game transitions.
 */
@Service
public class GameService {
    private static final Logger logger = LoggerFactory.getLogger(GameService.class);
    private static final String ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern SQUARE_PATTERN = Pattern.compile("^[a-h][1-8]$");

    private final GameManager gameManager;
    private final GameTimerService timerService;

    public GameService(GameManager gameManager, GameTimerService timerService) {
        this.gameManager = gameManager;
        this.timerService = timerService;
    }

    /**
     * Generates a clean, unique 6-character room identifier.
     */
    public String generateUniqueRoomCode() {
        String code;
        int attempts = 0;
        do {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(ROOM_CODE_CHARS.charAt(RANDOM.nextInt(ROOM_CODE_CHARS.length())));
            }
            code = sb.toString();
            attempts++;
        } while (gameManager.roomExists(code) && attempts < 100);
        return code;
    }

    /**
     * Creates a new game room with specified time limit in minutes.
     */
    public GameRoom createGame(String roomId, Integer timeLimit) {
        return gameManager.createGame(roomId, timeLimit);
    }

    /**
     * Retrieves an active game room.
     */
    public GameRoom getGame(String roomId) {
        return gameManager.getGame(roomId);
    }

    /**
     * Finds the room associated with a player's session ID.
     */
    public String findRoomByPlayerId(String sessionId) {
        return gameManager.findRoomByPlayerId(sessionId);
    }

    /**
     * Resolves player role assignment: White, Black, Spectator, or Reconnection.
     * Prevents session hijacking when a shared link contains ?color=white.
     */
    public String resolvePlayerRole(GameRoom game, String requestedColor) {
        if ("joiner".equalsIgnoreCase(requestedColor)) {
            if (game.getPlayers().isEmpty()) {
                return "white";
            }
            Player whitePlayer = game.findPlayerByColor("white");
            Player blackPlayer = game.findPlayerByColor("black");
            if (whitePlayer == null) return "white";
            if (blackPlayer == null) return "black";
            return "spectator";
        }

        String color = requestedColor != null ? requestedColor.toLowerCase() : "white";
        Player existingPlayer = game.findPlayerByColor(color);

        // If no player has this color yet, grant it
        if (existingPlayer == null) {
            return color;
        }

        // If player with this color exists, check if they are disconnected (reconnection eligible)
        boolean isDisconnected = game.getDisconnectTimers().containsKey(existingPlayer.getId());
        if (isDisconnected) {
            return color;
        }

        // Color is actively occupied by a connected player. Assign the remaining color if free.
        String oppositeColor = "white".equals(color) ? "black" : "white";
        if (game.findPlayerByColor(oppositeColor) == null) {
            return oppositeColor;
        }

        // Both White and Black slots are filled and active -> Spectator
        return "spectator";
    }

    /**
     * Validates and processes a chess move submitted by a player.
     * Enforces:
     * 1. Game state must be active.
     * 2. Sender must be an active playing participant (not spectator).
     * 3. Server-side turn ownership: only the player whose turn it is can move.
     * 4. Move coordinate sanity: source and destination must be valid chess squares.
     * 5. FEN integrity: validates structure, preserves kings, and verifies expected next-turn token.
     *
     * @return true if move was accepted and applied, false if rejected
     */
    public boolean processMove(GameRoom game, String sessionId, Move move, String fen) {
        if (game == null || game.isGameOver() || !game.isGameStarted()) {
            logger.warn("Move rejected: Game is not in an active playable state.");
            return false;
        }

        Player player = game.findPlayerById(sessionId);
        if (player == null || "spectator".equalsIgnoreCase(player.getColor())) {
            logger.warn("Move rejected: Session {} is not an active playing participant.", sessionId);
            return false;
        }

        // 1. Strict server-side turn validation
        if (!game.isPlayerTurn(player)) {
            logger.warn("Move rejected: Turn violation! Current turn is {}, but player {} attempted to move.",
                    game.getCurrentTurn(), player.getColor());
            return false;
        }

        // 2. Validate move coordinates (from/to squares must be valid algebraic chess coordinates)
        if (!isValidMoveCoordinates(move)) {
            logger.warn("Move rejected: Invalid move coordinates in room {}: {}", game.getRoomId(), move);
            return false;
        }

        // 3. Validate FEN structure and turn consistency
        if (!isValidFen(fen, game.getCurrentTurn())) {
            logger.warn("Move rejected: Invalid or inconsistent FEN supplied in room {}: {}", game.getRoomId(), fen);
            return false;
        }

        // Update timers based on elapsed thinking time
        if (game.getTimeLimit() != null && game.getLastMoveTime() != null) {
            long now = System.currentTimeMillis();
            long elapsed = now - game.getLastMoveTime();
            game.setLastMoveTime(now);

            if ("w".equalsIgnoreCase(game.getCurrentTurn())) {
                game.setTimerW(Math.max(0, (game.getTimerW() != null ? game.getTimerW() : 0) - elapsed));
            } else {
                game.setTimerB(Math.max(0, (game.getTimerB() != null ? game.getTimerB() : 0) - elapsed));
            }
        }

        // Update state and switch turn on server
        game.setFen(fen);
        game.switchTurn();
        logger.info("♟️ Move accepted in room {}. Turn switched to {}", game.getRoomId(), game.getCurrentTurn());
        return true;
    }

    /**
     * Validates that the move coordinates represent valid chess squares on an 8x8 board.
     */
    public boolean isValidMoveCoordinates(Move move) {
        if (move == null) return false;
        String from = move.getFrom();
        String to = move.getTo();
        if (from == null || to == null) return false;

        from = from.trim().toLowerCase();
        to = to.trim().toLowerCase();

        if (from.equals(to)) return false;
        return SQUARE_PATTERN.matcher(from).matches() && SQUARE_PATTERN.matcher(to).matches();
    }

    /**
     * Validates that the FEN string adheres to standard chess notation rules:
     * - 6 space-delimited tokens
     * - 8 ranks on board
     * - Both Kings are preserved on the board
     * - Next-turn token matches the expected next player ('b' after White moves, 'w' after Black moves)
     */
    public boolean isValidFen(String fen, String currentTurn) {
        if (fen == null || fen.trim().isEmpty()) return false;

        String[] parts = fen.trim().split("\\s+");
        if (parts.length != 6) return false;

        String boardPlacement = parts[0];
        String nextTurn = parts[1];

        // Must have 8 board ranks
        String[] ranks = boardPlacement.split("/");
        if (ranks.length != 8) return false;

        // Must preserve both White King ('K') and Black King ('k')
        if (boardPlacement.indexOf('K') == -1 || boardPlacement.indexOf('k') == -1) {
            return false;
        }

        // Next-turn token in FEN must reflect who moves NEXT:
        // After White moves ("w"), next turn must be 'b'
        // After Black moves ("b"), next turn must be 'w'
        if ("w".equalsIgnoreCase(currentTurn) && !"b".equals(nextTurn)) {
            return false;
        }
        if ("b".equalsIgnoreCase(currentTurn) && !"w".equals(nextTurn)) {
            return false;
        }

        return true;
    }

    /**
     * Starts game clocks for a match.
     */
    public void startGameTimer(GameRoom game,
                               BiConsumer<String, Map<String, Object>> timeSyncBroadcaster,
                               BiConsumer<String, Map<String, Object>> gameOverBroadcaster) {
        timerService.startGameTimer(game, timeSyncBroadcaster, gameOverBroadcaster);
    }

    /**
     * Stops game clocks for a match.
     */
    public void stopGameTimer(GameRoom game) {
        timerService.stopGameTimer(game);
    }

    /**
     * Removes a player and cleans up empty rooms.
     */
    public void removePlayerFromGame(String sessionId) {
        for (String roomId : gameManager.getAllGames().keySet()) {
            GameRoom game = gameManager.getGame(roomId);
            if (game == null) continue;

            game.removePlayer(sessionId);

            ScheduledFuture<?> disconnectTimer = game.getDisconnectTimers().remove(sessionId);
            if (disconnectTimer != null) {
                disconnectTimer.cancel(false);
            }

            if (game.getPlayers().isEmpty()) {
                timerService.stopGameTimer(game);
                gameManager.removeGame(roomId);
                logger.info("🗑️ Game room {} deleted as all players departed.", roomId);
            }
        }
    }

    /**
     * Schedules a disconnect grace period task.
     */
    public ScheduledFuture<?> scheduleGracePeriod(Runnable task, long delaySeconds) {
        return timerService.scheduleTask(task, delaySeconds, TimeUnit.SECONDS);
    }
}
