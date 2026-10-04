package com.kingside.chess.manager;

import com.kingside.chess.model.GameRoom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages active in-memory chess game rooms.
 * Uses ConcurrentHashMap to ensure thread safety across concurrent WebSocket sessions.
 */
@Component
public class GameManager {
    private static final Logger logger = LoggerFactory.getLogger(GameManager.class);

    private final Map<String, GameRoom> games = new ConcurrentHashMap<>();

    /**
     * Creates and registers a new GameRoom.
     */
    public GameRoom createGame(String roomId, Integer timeLimit) {
        GameRoom room = new GameRoom(roomId, timeLimit);
        games.put(roomId, room);
        logger.info("Created game room {} (Time control: {} min). Total active rooms: {}", roomId, timeLimit, games.size());
        return room;
    }

    /**
     * Retrieves an active GameRoom by its room ID.
     */
    public GameRoom getGame(String roomId) {
        if (roomId == null) return null;
        return games.get(roomId.toUpperCase());
    }

    /**
     * Checks if a room exists.
     */
    public boolean roomExists(String roomId) {
        if (roomId == null) return false;
        return games.containsKey(roomId.toUpperCase());
    }

    /**
     * Removes an active GameRoom from memory.
     */
    public GameRoom removeGame(String roomId) {
        if (roomId == null) return null;
        GameRoom removed = games.remove(roomId.toUpperCase());
        if (removed != null) {
            logger.info("Removed game room {}. Remaining active rooms: {}", roomId, games.size());
        }
        return removed;
    }

    /**
     * Finds the roomId where a player's WebSocket session ID is registered.
     */
    public String findRoomByPlayerId(String sessionId) {
        if (sessionId == null) return null;
        for (Map.Entry<String, GameRoom> entry : games.entrySet()) {
            GameRoom room = entry.getValue();
            if (room.findPlayerById(sessionId) != null) {
                return entry.getKey();
            }
        }
        return null;
    }

    /**
     * Returns an unmodifiable view of all active games.
     */
    public Map<String, GameRoom> getAllGames() {
        return games;
    }

    /**
     * Returns the current number of active rooms.
     */
    public int getActiveRoomCount() {
        return games.size();
    }
}
