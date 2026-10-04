package com.kingside.chess.model;

import com.fasterxml.jackson.databind.JsonNode;

public class WsMessage {
    private String event;
    private JsonNode data;

    public WsMessage() {}

    public WsMessage(String event, JsonNode data) {
        this.event = event;
        this.data = data;
    }

    public String getEvent() {
        return event;
    }

    public void setEvent(String event) {
        this.event = event;
    }

    public JsonNode getData() {
        return data;
    }

    public void setData(JsonNode data) {
        this.data = data;
    }
}
