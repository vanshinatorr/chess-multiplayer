package com.kingside.chess.model;

public class ChatMessage {
    private String senderColor;
    private String text;
    private long timestamp;

    public ChatMessage() {}

    public ChatMessage(String senderColor, String text, long timestamp) {
        this.senderColor = senderColor;
        this.text = text;
        this.timestamp = timestamp;
    }

    public String getSenderColor() {
        return senderColor;
    }

    public void setSenderColor(String senderColor) {
        this.senderColor = senderColor;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
