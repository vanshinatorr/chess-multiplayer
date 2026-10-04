package com.kingside.chess.service;

import com.kingside.chess.model.GameRoom;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.*;
import java.util.function.BiConsumer;

/**
 * Service responsible for server-side chess clocks and game timers.
 * Decrements the active player's clock at fixed intervals, broadcasts sync pulses,
 * and ends the game when a player flags (reaches 0 remaining time).
 */
@Service
public class GameTimerService {
    private static final Logger logger = LoggerFactory.getLogger(GameTimerService.class);

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4, r -> {
        Thread t = new Thread(r, "chess-timer-thread");
        t.setDaemon(true);
        return t;
    });

    /**
     * Starts the clock interval for an active GameRoom.
     * Only ticks if the game has a valid time limit.
     */
    public void startGameTimer(GameRoom game,
                               BiConsumer<String, Map<String, Object>> timeSyncBroadcaster,
                               BiConsumer<String, Map<String, Object>> gameOverBroadcaster) {
        if (game == null || game.getTimeLimit() == null || game.getTimeLimit() <= 0) {
            return;
        }

        // Avoid duplicate timer tasks
        if (game.getTimerInterval() != null && !game.getTimerInterval().isCancelled()) {
            return;
        }

        game.setLastMoveTime(System.currentTimeMillis());

        ScheduledFuture<?> interval = scheduler.scheduleAtFixedRate(() -> {
            try {
                if (game.isGameOver()) {
                    stopGameTimer(game);
                    return;
                }

                long now = System.currentTimeMillis();
                Long lastMove = game.getLastMoveTime();
                if (lastMove == null) {
                    lastMove = now;
                }
                long elapsed = now - lastMove;
                game.setLastMoveTime(now);

                if ("w".equalsIgnoreCase(game.getCurrentTurn())) {
                    long remainingW = Math.max(0, (game.getTimerW() != null ? game.getTimerW() : 0) - elapsed);
                    game.setTimerW(remainingW);

                    if (remainingW <= 0) {
                        game.setGameOver(true);
                        stopGameTimer(game);
                        logger.info("⏰ White timed out in room {}. Black wins by flag.", game.getRoomId());
                        Map<String, Object> gameOverPayload = Map.of(
                                "reason", "timeout",
                                "winner", "black",
                                "loser", "white"
                        );
                        gameOverBroadcaster.accept(game.getRoomId(), gameOverPayload);
                        return;
                    }
                } else {
                    long remainingB = Math.max(0, (game.getTimerB() != null ? game.getTimerB() : 0) - elapsed);
                    game.setTimerB(remainingB);

                    if (remainingB <= 0) {
                        game.setGameOver(true);
                        stopGameTimer(game);
                        logger.info("⏰ Black timed out in room {}. White wins by flag.", game.getRoomId());
                        Map<String, Object> gameOverPayload = Map.of(
                                "reason", "timeout",
                                "winner", "white",
                                "loser", "black"
                        );
                        gameOverBroadcaster.accept(game.getRoomId(), gameOverPayload);
                        return;
                    }
                }

                // Broadcast periodic time sync pulse to players in room
                Map<String, Object> timeSyncPayload = Map.of(
                        "timerW", game.getTimerW() != null ? game.getTimerW() : 0,
                        "timerB", game.getTimerB() != null ? game.getTimerB() : 0
                );
                timeSyncBroadcaster.accept(game.getRoomId(), timeSyncPayload);

            } catch (Exception e) {
                logger.error("Error during timer tick for room {}", game.getRoomId(), e);
            }
        }, 250, 250, TimeUnit.MILLISECONDS);

        game.setTimerInterval(interval);
        logger.info("⏱️ Timer started for room {} ({} min clock)", game.getRoomId(), game.getTimeLimit());
    }

    /**
     * Stops the running timer interval for a room.
     */
    public void stopGameTimer(GameRoom game) {
        if (game != null && game.getTimerInterval() != null) {
            game.getTimerInterval().cancel(false);
            game.setTimerInterval(null);
            logger.debug("⏱️ Timer stopped for room {}", game.getRoomId());
        }
    }

    /**
     * Schedules a one-off delayed task, such as a player disconnect grace countdown.
     */
    public ScheduledFuture<?> scheduleTask(Runnable task, long delay, TimeUnit unit) {
        return scheduler.schedule(task, delay, unit);
    }

    @PreDestroy
    public void shutdown() {
        logger.info("Shutting down GameTimerService scheduler");
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(2, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
