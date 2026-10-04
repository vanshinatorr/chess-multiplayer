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

/**
 * Core business logic service for chess gameplay, matchmaking, turn validation,
 * and game state transitions.
 */
@Service
public class GameService {
    private static final Logger logger = LoggerFactory.getLogger(GameService.class);
    private static final String ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

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
     */
    public String resolvePlayerRole(GameRoom game, String requestedColor) {
        if (game.getPlayers().size() >= 2 && "joiner".equalsIgnoreCase(requestedColor)) {
            return "spectator";
        }
        if ("joiner".equalsIgnoreCase(requestedColor)) {
            if (game.getPlayers().isEmpty()) {
                return "white";
            } else {
                String firstColor = game.getPlayers().get(0).getColor();
                return "white".equalsIgnoreCase(firstColor) ? "black" : "white";
            }
        }
        return requestedColor != null ? requestedColor.toLowerCase() : "white";
    }

    /**
     * Validates and processes a chess move submitted by a player.
     * Enforces server-side turn validation: players can only move on their assigned turn.
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

        // Server-side turn management validation
        if (!game.isPlayerTurn(player)) {
            logger.warn("Move rejected: Turn violation! Current turn is {}, but player {} attempted to move.",
                    game.getCurrentTurn(), player.getColor());
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
