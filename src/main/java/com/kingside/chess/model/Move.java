package com.kingside.chess.model;

/**
 * Represents a single chess move sent by a client.
 * Captures source and destination squares, piece type, and optional promotion.
 */
public class Move {
    private String from;
    private String to;
    private String piece;
    private String promotion;
    private String captured;
    private String san;

    public Move() {}

    public Move(String from, String to, String piece, String promotion, String captured, String san) {
        this.from = from;
        this.to = to;
        this.piece = piece;
        this.promotion = promotion;
        this.captured = captured;
        this.san = san;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public String getPiece() {
        return piece;
    }

    public void setPiece(String piece) {
        this.piece = piece;
    }

    public String getPromotion() {
        return promotion;
    }

    public void setPromotion(String promotion) {
        this.promotion = promotion;
    }

    public String getCaptured() {
        return captured;
    }

    public void setCaptured(String captured) {
        this.captured = captured;
    }

    public String getSan() {
        return san;
    }

    public void setSan(String san) {
        this.san = san;
    }

    @Override
    public String toString() {
        return "Move{" +
                "from='" + from + '\'' +
                ", to='" + to + '\'' +
                ", promotion='" + promotion + '\'' +
                ", san='" + san + '\'' +
                '}';
    }
}
