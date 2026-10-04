package com.kingside.chess.manager;

import com.kingside.chess.model.GameRoom;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GameManagerTest {

    private GameManager gameManager;

    @BeforeEach
    void setUp() {
        gameManager = new GameManager();
    }

    @Test
    @DisplayName("Should create and retrieve rooms correctly")
    void testCreateAndGetRoom() {
        GameRoom room = gameManager.createGame("TEST01", 5);
        assertNotNull(room);
        assertEquals("TEST01", room.getRoomId());
        assertTrue(gameManager.roomExists("TEST01"));
        assertTrue(gameManager.roomExists("test01"), "Room check should be case-insensitive");

        GameRoom fetched = gameManager.getGame("test01");
        assertSame(room, fetched);
        assertEquals(1, gameManager.getActiveRoomCount());
    }

    @Test
    @DisplayName("Should remove rooms cleanly")
    void testRemoveRoom() {
        gameManager.createGame("TEST02", 3);
        assertEquals(1, gameManager.getActiveRoomCount());

        GameRoom removed = gameManager.removeGame("TEST02");
        assertNotNull(removed);
        assertEquals(0, gameManager.getActiveRoomCount());
        assertFalse(gameManager.roomExists("TEST02"));
    }

    @Test
    @DisplayName("Should find room by player session ID")
    void testFindRoomByPlayerId() {
        GameRoom room = gameManager.createGame("TEST03", 5);
        room.addPlayer("player_session_123", "white");

        String foundRoomId = gameManager.findRoomByPlayerId("player_session_123");
        assertEquals("TEST03", foundRoomId);

        assertNull(gameManager.findRoomByPlayerId("non_existent_session"));
    }
}
