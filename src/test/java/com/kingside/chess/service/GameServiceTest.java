package com.kingside.chess.service;

import com.kingside.chess.manager.GameManager;
import com.kingside.chess.model.GameRoom;
import com.kingside.chess.model.Move;
import com.kingside.chess.model.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GameServiceTest {

    private GameManager gameManager;
    private GameTimerService timerService;
    private GameService gameService;

    @BeforeEach
    void setUp() {
        gameManager = new GameManager();
        timerService = new GameTimerService();
        gameService = new GameService(gameManager, timerService);
    }

    @Test
    @DisplayName("Should generate unique 6-character room codes")
    void testGenerateUniqueRoomCode() {
        String code1 = gameService.generateUniqueRoomCode();
        String code2 = gameService.generateUniqueRoomCode();

        assertNotNull(code1);
        assertNotNull(code2);
        assertEquals(6, code1.length());
        assertEquals(6, code2.length());
        assertNotEquals(code1, code2);
    }

    @Test
    @DisplayName("Should create game with specified clock limit")
    void testCreateGame() {
        GameRoom room = gameService.createGame("ROOM01", 5);

        assertNotNull(room);
        assertEquals("ROOM01", room.getRoomId());
        assertEquals(5, room.getTimeLimit());
        assertEquals(5 * 60 * 1000L, room.getTimerW());
        assertEquals(5 * 60 * 1000L, room.getTimerB());
        assertEquals("w", room.getCurrentTurn());
        assertFalse(room.isGameStarted());
        assertFalse(room.isGameOver());
    }

    @Test
    @DisplayName("Should resolve player roles correctly: White, Black, Spectator")
    void testPlayerRoleAssignment() {
        GameRoom room = gameService.createGame("ROOM02", 3);

        // Player 1 joins with "joiner" -> White
        String role1 = gameService.resolvePlayerRole(room, "joiner");
        assertEquals("white", role1);
        room.addPlayer("session1", role1);

        // Player 2 joins with "joiner" -> Black
        String role2 = gameService.resolvePlayerRole(room, "joiner");
        assertEquals("black", role2);
        room.addPlayer("session2", role2);

        // Player 3 joins when 2 players already present -> Spectator
        String role3 = gameService.resolvePlayerRole(room, "joiner");
        assertEquals("spectator", role3);
    }

    @Test
    @DisplayName("Should strictly enforce server-side turn validation")
    void testServerSideTurnManagement() {
        GameRoom room = gameService.createGame("ROOM03", 10);
        room.addPlayer("sess_white", "white");
        room.addPlayer("sess_black", "black");
        room.setGameStarted(true);

        Move whiteMove = new Move("e2", "e4", "p", null, null, "e4");
        Move blackMove = new Move("e7", "e5", "p", null, null, "e5");

        // 1. Black attempts to move while it's White's turn -> REJECTED
        boolean blackEarlyMoveAccepted = gameService.processMove(room, "sess_black", blackMove, "fen_black");
        assertFalse(blackEarlyMoveAccepted, "Black must not be allowed to move when it is White's turn.");
        assertEquals("w", room.getCurrentTurn());

        // 2. White moves on their turn -> ACCEPTED
        boolean whiteMoveAccepted = gameService.processMove(room, "sess_white", whiteMove, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
        assertTrue(whiteMoveAccepted, "White's legal move on White's turn must be accepted.");
        assertEquals("b", room.getCurrentTurn(), "Turn must switch to Black after White's move.");

        // 3. White attempts to move again out of turn -> REJECTED
        boolean whiteSecondMoveAccepted = gameService.processMove(room, "sess_white", whiteMove, "fen_white_again");
        assertFalse(whiteSecondMoveAccepted, "White must not be allowed to move consecutively.");
        assertEquals("b", room.getCurrentTurn());

        // 4. Black moves on Black's turn -> ACCEPTED
        boolean blackMoveAccepted = gameService.processMove(room, "sess_black", blackMove, "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
        assertTrue(blackMoveAccepted, "Black's legal move on Black's turn must be accepted.");
        assertEquals("w", room.getCurrentTurn(), "Turn must switch back to White after Black's move.");
    }

    @Test
    @DisplayName("Should reject moves from spectators")
    void testSpectatorMoveRejected() {
        GameRoom room = gameService.createGame("ROOM04", 5);
        room.addPlayer("sess_white", "white");
        room.addPlayer("sess_black", "black");
        room.addPlayer("sess_spec", "spectator");
        room.setGameStarted(true);

        Move specMove = new Move("e2", "e4", "p", null, null, "e4");
        boolean accepted = gameService.processMove(room, "sess_spec", specMove, "fen_spec");
        assertFalse(accepted, "Spectators cannot make moves.");
    }

    @Test
    @DisplayName("Should cleanly clean up empty rooms upon player departure")
    void testCleanupEmptyRoom() {
        gameService.createGame("ROOM05", 5);
        GameRoom room = gameManager.getGame("ROOM05");
        assertNotNull(room);

        room.addPlayer("sess_only", "white");
        assertEquals("ROOM05", gameService.findRoomByPlayerId("sess_only"));

        gameService.removePlayerFromGame("sess_only");
        assertNull(gameManager.getGame("ROOM05"), "Empty room must be removed from GameManager.");
    }
}
