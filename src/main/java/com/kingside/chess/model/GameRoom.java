package com.kingside.chess.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ScheduledFuture;

/**
 * Represents an active game room holding players, current board FEN,
 * game clocks, turn management, and real-time state.
 *
 * Thread-safe by utilizing CopyOnWriteArrayList and ConcurrentHashMap.
 */
public class GameRoom {
    private final String roomId;
    private final List<Player> players = new CopyOnWriteArrayList<>();
    private String fen;
    private String currentTurn = "w"; // "w" = White, "b" = Black
    private Integer timeLimit;        // in minutes, null = untimed
    private Long timerW;              // remaining milliseconds for White
    private Long timerB;              // remaining milliseconds for Black
    private Long lastMoveTime;        // epoch timestamp of last move/start
    private boolean gameStarted = false;
    private boolean gameOver = false;
    private final List<ChatMessage> chatHistory = new CopyOnWriteArrayList<>();
    private final Map<String, ScheduledFuture<?>> disconnectTimers = new ConcurrentHashMap<>();
    private ScheduledFuture<?> timerInterval;

    public GameRoom(String roomId, Integer timeLimit) {
        this.roomId = roomId;
        this.timeLimit = timeLimit;
        Long durationMs = timeLimit != null && timeLimit > 0 ? timeLimit * 60 * 1000L : null;
        this.timerW = durationMs;
        this.timerB = durationMs;
    }

    public String getRoomId() {
        return roomId;
    }

    public List<Player> getPlayers() {
        return players;
    }

    public void addPlayer(String sessionId, String color) {
        Player existing = findPlayerById(sessionId);
        if (existing == null) {
            players.add(new Player(sessionId, color));
        }
    }

    public void removePlayer(String sessionId) {
        players.removeIf(p -> p.getId().equals(sessionId));
    }

    public Player findPlayerById(String sessionId) {
        return players.stream()
                .filter(p -> p.getId().equals(sessionId))
                .findFirst()
                .orElse(null);
    }

    public Player findPlayerByColor(String color) {
        return players.stream()
                .filter(p -> p.getColor().equalsIgnoreCase(color))
                .findFirst()
                .orElse(null);
    }

    public boolean isPlayerTurn(Player player) {
        if (player == null || player.getColor() == null) return false;
        String playerColor = player.getColor().toLowerCase();
        if ("w".equals(currentTurn) && "white".equals(playerColor)) return true;
        return "b".equals(currentTurn) && "black".equals(playerColor);
    }

    public void switchTurn() {
        this.currentTurn = "w".equals(this.currentTurn) ? "b" : "w";
    }

    public GameState toSnapshot() {
        return toSnapshot(null);
    }

    public GameState toSnapshot(String recipientColor) {
        return new GameState(
                roomId,
                recipientColor,
                fen,
                currentTurn,
                timerW,
                timerB,
                timeLimit,
                gameStarted,
                gameOver,
                new ArrayList<>(players),
                new ArrayList<>(chatHistory)
        );
    }

    public String getFen() {
        return fen;
    }

    public void setFen(String fen) {
        this.fen = fen;
    }

    public String getCurrentTurn() {
        return currentTurn;
    }

    public void setCurrentTurn(String currentTurn) {
        this.currentTurn = currentTurn;
    }

    public Integer getTimeLimit() {
        return timeLimit;
    }

    public void setTimeLimit(Integer timeLimit) {
        this.timeLimit = timeLimit;
    }

    public Long getTimerW() {
        return timerW;
    }

    public void setTimerW(Long timerW) {
        this.timerW = timerW;
    }

    public Long getTimerB() {
        return timerB;
    }

    public void setTimerB(Long timerB) {
        this.timerB = timerB;
    }

    public Long getLastMoveTime() {
        return lastMoveTime;
    }

    public void setLastMoveTime(Long lastMoveTime) {
        this.lastMoveTime = lastMoveTime;
    }

    public boolean isGameStarted() {
        return gameStarted;
    }

    public void setGameStarted(boolean gameStarted) {
        this.gameStarted = gameStarted;
    }

    public boolean isGameOver() {
        return gameOver;
    }

    public void setGameOver(boolean gameOver) {
        this.gameOver = gameOver;
    }

    public List<ChatMessage> getChatHistory() {
        return chatHistory;
    }

    public Map<String, ScheduledFuture<?>> getDisconnectTimers() {
        return disconnectTimers;
    }

    public ScheduledFuture<?> getTimerInterval() {
        return timerInterval;
    }

    public void setTimerInterval(ScheduledFuture<?> timerInterval) {
        this.timerInterval = timerInterval;
    }
}
