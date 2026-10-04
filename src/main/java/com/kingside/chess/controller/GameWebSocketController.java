package com.kingside.chess.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kingside.chess.model.*;
import com.kingside.chess.service.GameService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * Primary WebSocket Controller handling client connections, message dispatching,
 * real-time gameplay events, and session synchronization.
 */
@Component
public class GameWebSocketController extends TextWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(GameWebSocketController.class);

    private final GameService gameService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public GameWebSocketController(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
        logger.info("🔌 Player WebSocket session connected: {}", session.getId());

        // Send connection acknowledgment with session ID
        sendMessage(session, "_connection_ack", Map.of("socketId", session.getId()));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payloadStr = message.getPayload();
        WsMessage wsMsg = objectMapper.readValue(payloadStr, WsMessage.class);
        String event = wsMsg.getEvent();
        JsonNode data = wsMsg.getData();

        if (event == null) return;

        switch (event) {
            case "create-game":
                handleCreateGame(session, data);
                break;
            case "join-game":
                handleJoinGame(session, data);
                break;
            case "join-game-room":
                handleJoinGameRoom(session, data);
                break;
            case "move-made":
                handleMoveMade(session, data);
                break;
            case "resign":
                handleResign(session, data);
                break;
            case "chat-message":
                handleChatMessage(session, data);
                break;
            case "draw-offer":
                handleDrawOffer(session, data);
                break;
            case "draw-response":
                handleDrawResponse(session, data);
                break;
            case "rematch-offer":
                handleRematchOffer(session, data);
                break;
            case "rematch-response":
                handleRematchResponse(session, data);
                break;
            case "game-ended":
                handleGameEnded(session, data);
                break;
            default:
                logger.warn("Received unhandled WebSocket event: {}", event);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        String roomId = gameService.findRoomByPlayerId(sessionId);

        if (roomId != null) {
            GameRoom game = gameService.getGame(roomId);
            if (game != null && !game.isGameOver()) {
                Player player = game.findPlayerById(sessionId);
                if (player != null && !"spectator".equalsIgnoreCase(player.getColor())) {
                    logger.info("⚠️ Player {} disconnected from {}. Initiating 30s reconnect grace window.",
                            player.getColor(), roomId);

                    // Notify opponent of disconnection grace countdown
                    sendToOtherInRoom(roomId, sessionId, "player-disconnected-countdown", Map.of(
                            "color", player.getColor(),
                            "seconds", 30
                    ));

                    // Schedule 30-second grace abandonment timer
                    ScheduledFuture<?> disconnectFuture = gameService.scheduleGracePeriod(() -> {
                        logger.info("❌ Reconnection timeout expired for {} in room {}", player.getColor(), roomId);
                        game.setGameOver(true);
                        gameService.stopGameTimer(game);

                        String winnerColor = "white".equalsIgnoreCase(player.getColor()) ? "black" : "white";
                        broadcastToRoom(roomId, "game-over", Map.of(
                                "reason", "abandoned",
                                "winner", winnerColor,
                                "loser", player.getColor()
                        ));

                        gameService.removePlayerFromGame(sessionId);
                    }, 30);

                    game.getDisconnectTimers().put(sessionId, disconnectFuture);
                } else {
                    gameService.removePlayerFromGame(sessionId);
                }
            } else {
                gameService.removePlayerFromGame(sessionId);
            }
        } else {
            gameService.removePlayerFromGame(sessionId);
        }

        sessions.remove(sessionId);
        logger.info("❌ Closed session {}", sessionId);
    }

    // --- EVENT HANDLERS ---

    private void handleCreateGame(WebSocketSession session, JsonNode data) {
        Integer timeLimit = (data.has("timeLimit") && !data.get("timeLimit").isNull())
                ? data.get("timeLimit").asInt() : null;

        String roomId = gameService.generateUniqueRoomCode();
        gameService.createGame(roomId, timeLimit);
        logger.info("🎮 Room created: {} (Time control: {} min)", roomId, timeLimit);

        sendMessage(session, "game-created", Map.of("roomId", roomId));
    }

    private void handleJoinGame(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId")) return;
        String roomId = data.get("roomId").asText().trim().toUpperCase();
        GameRoom game = gameService.getGame(roomId);

        if (game == null) {
            sendMessage(session, "error-message", Map.of("message", "Room not found!"));
            return;
        }
        if (game.getPlayers().size() >= 2) {
            sendMessage(session, "error-message", Map.of("message", "Room is full!"));
            return;
        }

        sendMessage(session, "game-joined", Map.of("roomId", roomId));
    }

    private void handleJoinGameRoom(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId")) return;
        String roomId = data.get("roomId").asText().trim().toUpperCase();
        String requestedColor = data.has("color") ? data.get("color").asText() : "joiner";
        Integer timeLimit = (data.has("timeLimit") && !data.get("timeLimit").isNull())
                ? data.get("timeLimit").asInt() : null;

        GameRoom game = gameService.getGame(roomId);
        if (game == null) {
            game = gameService.createGame(roomId, timeLimit);
        }

        String resolvedRole = gameService.resolvePlayerRole(game, requestedColor);

        // Check if this is a reconnecting player
        if (!"spectator".equalsIgnoreCase(resolvedRole)) {
            Player existingPlayer = game.findPlayerByColor(resolvedRole);
            if (existingPlayer != null && game.getDisconnectTimers().containsKey(existingPlayer.getId())) {
                String oldSessionId = existingPlayer.getId();
                existingPlayer.setId(session.getId());

                ScheduledFuture<?> disconnectFuture = game.getDisconnectTimers().remove(oldSessionId);
                if (disconnectFuture != null) {
                    disconnectFuture.cancel(false);
                    logger.info("🔄 Cleared disconnect grace timer for {} in room {}", resolvedRole, roomId);
                }

                // Send complete current game state snapshot to reconnected player
                GameState snapshot = game.toSnapshot(resolvedRole);
                sendMessage(session, "reconnected-state", snapshot);

                // Notify other player in room
                sendToOtherInRoom(roomId, session.getId(), "player-reconnected", Map.of("color", resolvedRole));
                return;
            }
        }

        // Check if player enters as Spectator
        if ("spectator".equalsIgnoreCase(resolvedRole) || game.getPlayers().size() >= 2) {
            logger.info("👁️ User joined as spectator in room {}: session {}", roomId, session.getId());
            game.addPlayer(session.getId(), "spectator");
            GameState snapshot = game.toSnapshot("spectator");
            sendMessage(session, "reconnected-state", snapshot);
            return;
        }

        // Register new player (White or Black)
        game.addPlayer(session.getId(), resolvedRole);
        logger.info("✅ Player assigned {} in room {}", resolvedRole, roomId);
        sendMessage(session, "color-assigned", Map.of("color", resolvedRole));

        // When both players are ready, launch the game and activate timers
        if (game.getPlayers().size() >= 2) {
            game.setGameStarted(true);
            broadcastToRoom(roomId, "game-start", Map.of(
                    "timeLimit", game.getTimeLimit() != null ? game.getTimeLimit() : 0,
                    "timerW", game.getTimerW() != null ? game.getTimerW() : 0,
                    "timerB", game.getTimerB() != null ? game.getTimerB() : 0
            ));

            gameService.startGameTimer(game,
                    (rId, timePayload) -> broadcastToRoom(rId, "time-sync", timePayload),
                    (rId, overPayload) -> broadcastToRoom(rId, "game-over", overPayload)
            );
        } else {
            sendMessage(session, "waiting-for-opponent", Map.of());
        }
    }

    private void handleMoveMade(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId") || !data.has("fen") || !data.has("move")) return;
        String roomId = data.get("roomId").asText();
        String fen = data.get("fen").asText();
        JsonNode moveNode = data.get("move");

        GameRoom game = gameService.getGame(roomId);
        if (game == null) return;

        Move move = objectMapper.convertValue(moveNode, Move.class);

        // Server-side validation of turn and player role
        boolean accepted = gameService.processMove(game, session.getId(), move, fen);
        if (!accepted) {
            logger.warn("Move rejected by GameService for session {} in room {}", session.getId(), roomId);
            return;
        }

        // Broadcast move update to opponent and spectators
        sendToOtherInRoom(roomId, session.getId(), "move-update", Map.of(
                "move", moveNode,
                "fen", fen,
                "timerW", game.getTimerW() != null ? game.getTimerW() : 0,
                "timerB", game.getTimerB() != null ? game.getTimerB() : 0,
                "currentTurn", game.getCurrentTurn()
        ));
    }

    private void handleResign(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId")) return;
        String roomId = data.get("roomId").asText();

        GameRoom game = gameService.getGame(roomId);
        if (game == null || game.isGameOver()) return;

        Player player = game.findPlayerById(session.getId());
        if (player == null || "spectator".equalsIgnoreCase(player.getColor())) return;

        game.setGameOver(true);
        gameService.stopGameTimer(game);

        String winnerColor = "white".equalsIgnoreCase(player.getColor()) ? "black" : "white";
        broadcastToRoom(roomId, "game-over", Map.of(
                "reason", "resign",
                "winner", winnerColor,
                "loser", player.getColor()
        ));
    }

    private void handleChatMessage(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId") || !data.has("message")) return;
        String roomId = data.get("roomId").asText();
        String text = data.get("message").asText();

        GameRoom game = gameService.getGame(roomId);
        if (game == null) return;

        Player player = game.findPlayerById(session.getId());
        String senderColor = player != null ? player.getColor() : "spectator";

        ChatMessage chatMsg = new ChatMessage(senderColor, text, System.currentTimeMillis());
        game.getChatHistory().add(chatMsg);

        broadcastToRoom(roomId, "chat-message-received", chatMsg);
    }

    private void handleDrawOffer(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId")) return;
        String roomId = data.get("roomId").asText();

        GameRoom game = gameService.getGame(roomId);
        if (game == null || game.isGameOver()) return;

        Player player = game.findPlayerById(session.getId());
        if (player == null || "spectator".equalsIgnoreCase(player.getColor())) return;

        sendToOtherInRoom(roomId, session.getId(), "draw-offered", Map.of("color", player.getColor()));
    }

    private void handleDrawResponse(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId") || !data.has("accepted")) return;
        String roomId = data.get("roomId").asText();
        boolean accepted = data.get("accepted").asBoolean();

        GameRoom game = gameService.getGame(roomId);
        if (game == null || game.isGameOver()) return;

        if (accepted) {
            game.setGameOver(true);
            gameService.stopGameTimer(game);
            broadcastToRoom(roomId, "game-over", Map.of("reason", "draw-agreement"));
        } else {
            sendToOtherInRoom(roomId, session.getId(), "draw-declined", Map.of());
        }
    }

    private void handleRematchOffer(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId")) return;
        String roomId = data.get("roomId").asText();

        GameRoom game = gameService.getGame(roomId);
        if (game == null) return;

        Player player = game.findPlayerById(session.getId());
        if (player == null) return;

        sendToOtherInRoom(roomId, session.getId(), "rematch-offered", Map.of("color", player.getColor()));
    }

    private void handleRematchResponse(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId") || !data.has("accepted")) return;
        String roomId = data.get("roomId").asText();
        boolean accepted = data.get("accepted").asBoolean();

        GameRoom game = gameService.getGame(roomId);
        if (game == null) return;

        if (accepted) {
            game.setGameOver(false);
            game.setGameStarted(true);
            game.setFen(null);
            game.setCurrentTurn("w");

            Long durationMs = game.getTimeLimit() != null && game.getTimeLimit() > 0
                    ? game.getTimeLimit() * 60 * 1000L : null;
            game.setTimerW(durationMs);
            game.setTimerB(durationMs);
            game.setLastMoveTime(null);
            game.getChatHistory().clear();

            // Swap player colors on rematch
            if (game.getPlayers().size() >= 2) {
                Player p1 = game.getPlayers().get(0);
                Player p2 = game.getPlayers().get(1);
                String tempColor = p1.getColor();
                p1.setColor(p2.getColor());
                p2.setColor(tempColor);
                logger.info("🔄 Rematch accepted: Colors swapped (P1: {}, P2: {})", p1.getColor(), p2.getColor());
            }

            gameService.stopGameTimer(game);

            for (Player p : game.getPlayers()) {
                WebSocketSession pSession = sessions.get(p.getId());
                if (pSession != null && pSession.isOpen()) {
                    sendMessage(pSession, "rematch-start", Map.of(
                            "color", p.getColor(),
                            "timeLimit", game.getTimeLimit() != null ? game.getTimeLimit() : 0,
                            "timerW", game.getTimerW() != null ? game.getTimerW() : 0,
                            "timerB", game.getTimerB() != null ? game.getTimerB() : 0
                    ));
                }
            }

            gameService.startGameTimer(game,
                    (rId, timePayload) -> broadcastToRoom(rId, "time-sync", timePayload),
                    (rId, overPayload) -> broadcastToRoom(rId, "game-over", overPayload)
            );
        } else {
            sendToOtherInRoom(roomId, session.getId(), "rematch-declined", Map.of());
        }
    }

    private void handleGameEnded(WebSocketSession session, JsonNode data) {
        if (!data.has("roomId") || !data.has("reason")) return;
        String roomId = data.get("roomId").asText();
        String reason = data.get("reason").asText();
        String winner = data.has("winner") ? data.get("winner").asText() : null;

        GameRoom game = gameService.getGame(roomId);
        if (game == null || game.isGameOver()) return;

        game.setGameOver(true);
        gameService.stopGameTimer(game);

        Map<String, Object> payload = new HashMap<>();
        payload.put("reason", reason);
        if (winner != null) payload.put("winner", winner);

        broadcastToRoom(roomId, "game-over", payload);
    }

    // --- MESSAGING UTILITIES ---

    private void sendMessage(WebSocketSession session, String event, Object data) {
        if (session != null && session.isOpen()) {
            try {
                Map<String, Object> msg = Map.of("event", event, "data", data != null ? data : Map.of());
                String json = objectMapper.writeValueAsString(msg);
                synchronized (session) {
                    session.sendMessage(new TextMessage(json));
                }
            } catch (IOException e) {
                logger.error("Failed to send WebSocket message to session {}", session.getId(), e);
            }
        }
    }

    private void broadcastToRoom(String roomId, String event, Object data) {
        GameRoom game = gameService.getGame(roomId);
        if (game == null) return;

        for (Player p : game.getPlayers()) {
            WebSocketSession s = sessions.get(p.getId());
            sendMessage(s, event, data);
        }
    }

    private void sendToOtherInRoom(String roomId, String senderSessionId, String event, Object data) {
        GameRoom game = gameService.getGame(roomId);
        if (game == null) return;

        for (Player p : game.getPlayers()) {
            if (!p.getId().equals(senderSessionId)) {
                WebSocketSession s = sessions.get(p.getId());
                sendMessage(s, event, data);
            }
        }
    }
}
