package com.kingside.chess.config;

import com.kingside.chess.controller.GameWebSocketController;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket configuration class that registers the GameWebSocketController handler
 * on the "/ws" endpoint and allows cross-origin requests.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameWebSocketController gameWebSocketController;

    public WebSocketConfig(GameWebSocketController gameWebSocketController) {
        this.gameWebSocketController = gameWebSocketController;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(gameWebSocketController, "/ws")
                .setAllowedOrigins("*");
    }
}
