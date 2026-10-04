package com.kingside.chess.service;

import com.kingside.chess.model.GameRoom;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class GameTimerServiceTest {

    private GameTimerService timerService;

    @BeforeEach
    void setUp() {
        timerService = new GameTimerService();
    }

    @AfterEach
    void tearDown() {
        timerService.shutdown();
    }

    @Test
    @DisplayName("Should decrement active player's clock and send time sync")
    void testTimerTick() throws InterruptedException {
        GameRoom room = new GameRoom("TIMER_TEST", 1);
        room.setGameStarted(true);

        CountDownLatch syncLatch = new CountDownLatch(2);

        timerService.startGameTimer(
                room,
                (rId, payload) -> syncLatch.countDown(),
                (rId, payload) -> {}
        );

        boolean ticked = syncLatch.await(2, TimeUnit.SECONDS);
        timerService.stopGameTimer(room);

        assertTrue(ticked, "Timer should tick and fire sync events periodically.");
        assertTrue(room.getTimerW() < 60 * 1000L, "White timer should have decreased from initial 60,000ms.");
        assertEquals(60 * 1000L, room.getTimerB(), "Black timer should remain untouched while White's turn.");
    }

    @Test
    @DisplayName("Should detect timeout and trigger game-over when clock hits 0")
    void testTimerFlagTimeout() throws InterruptedException {
        GameRoom room = new GameRoom("TIMEOUT_TEST", 1);
        // Artificially set remaining white clock to 100ms
        room.setTimerW(100L);
        room.setGameStarted(true);

        CountDownLatch timeoutLatch = new CountDownLatch(1);
        AtomicBoolean blackWon = new AtomicBoolean(false);

        timerService.startGameTimer(
                room,
                (rId, payload) -> {},
                (rId, payload) -> {
                    if ("timeout".equals(payload.get("reason")) && "black".equals(payload.get("winner"))) {
                        blackWon.set(true);
                    }
                    timeoutLatch.countDown();
                }
        );

        boolean timedOut = timeoutLatch.await(3, TimeUnit.SECONDS);
        timerService.stopGameTimer(room);

        assertTrue(timedOut, "Game over callback should fire on flag timeout.");
        assertTrue(blackWon.get(), "Black must be declared winner when White flags.");
        assertTrue(room.isGameOver(), "Room must be marked gameOver.");
    }
}
