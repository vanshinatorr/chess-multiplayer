package com.kingside.chess.model;

public class Player {
    private String id; // WebSocket session ID
    private String color; // "white", "black", or "spectator"

    public Player() {}

    public Player(String id, String color) {
        this.id = id;
        this.color = color;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }
}
