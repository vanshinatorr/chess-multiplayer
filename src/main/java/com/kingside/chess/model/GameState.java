package com.kingside.chess.model;

import java.util.List;

/**
 * Encapsulates the complete snapshot of a game's state at any point in time.
 * Used for client synchronization upon connection, reconnection, or spectator entry.
 */
public class GameState {
    private String roomId;
    private String color;       // Assigned color/role for the recipient player ("white", "black", "spectator")
    private String fen;
    private String currentTurn; // "w" for White, "b" for Black
    private Long timerW;        // Remaining milliseconds for White
    private Long timerB;        // Remaining milliseconds for Black
    private Integer timeLimit;  // Total time limit in minutes
    private boolean gameStarted;
    private boolean gameOver;
    private List<Player> players;
    private List<ChatMessage> chatHistory;

    public GameState() {}

    public GameState(String roomId, String color, String fen, String currentTurn, Long timerW, Long timerB,
                     Integer timeLimit, boolean gameStarted, boolean gameOver,
                     List<Player> players, List<ChatMessage> chatHistory) {
        this.roomId = roomId;
        this.color = color;
        this.fen = fen;
        this.currentTurn = currentTurn;
        this.timerW = timerW;
        this.timerB = timerB;
        this.timeLimit = timeLimit;
        this.gameStarted = gameStarted;
        this.gameOver = gameOver;
        this.players = players;
        this.chatHistory = chatHistory;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
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

    public Integer getTimeLimit() {
        return timeLimit;
    }

    public void setTimeLimit(Integer timeLimit) {
        this.timeLimit = timeLimit;
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

    public List<Player> getPlayers() {
        return players;
    }

    public void setPlayers(List<Player> players) {
        this.players = players;
    }

    public List<ChatMessage> getChatHistory() {
        return chatHistory;
    }

    public void setChatHistory(List<ChatMessage> chatHistory) {
        this.chatHistory = chatHistory;
    }
}
