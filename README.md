# Multiplayer Chess Platform

## Overview
Multiplayer Chess Platform is a lightweight, real-time multiplayer chess application built with Java, Spring Boot, and WebSockets. The system enables two players to connect through web browsers, create or join isolated game rooms via 6-character room codes, and play synchronized chess matches with server-managed clocks and turn enforcement.

The platform was designed with an interview-first philosophy, prioritizing clean separation of concerns, readable architecture, and thread-safe in-memory state management. By replacing traditional HTTP polling with full-duplex WebSocket communication, players experience instant move broadcasts, live clock synchronization, in-game chat, and an automated reconnection grace window without external dependencies like databases or message brokers.

All active game rooms, player sessions, and clocks are managed in-memory on the Spring Boot server using concurrent data structures (`ConcurrentHashMap`, `CopyOnWriteArrayList`). Active games are intentionally kept in-memory for this minor project to remain lightweight, clean, and easy to explain.

## Features
- **Real-Time Multiplayer Chess**: Instant bidirectional move and game event transmission over WebSocket.
- **Room-Based Matchmaking**: Players can generate custom rooms with configurable clock controls (Blitz, Rapid, Classical, Unlimited) or join an existing room with a 6-digit code.
- **White / Black Player Assignment**: Automatic or preference-based color resolution ensuring one White player and one Black player per match, with safe fallback preventing session hijacking.
- **Server-Side Turn & Move Integrity Validation**: Strict server validation preventing out-of-turn moves, consecutive moves, invalid board coordinates, or moves from non-participating spectators.
- **In-Memory Game State**: Rooms maintain board FEN, active turns, move timestamps, player session mappings, and chat history.
- **Server-Side Game Timers**: Dedicated timer scheduler decrements only the active player's clock, broadcasts periodic time synchronizations, and automatically awards the win on timeout flag.
- **Real-Time WebSocket Synchronization**: Game state, move updates, clocks, chat messages, resignations, draw agreements, and rematches are broadcast in real time.
- **Disconnect / Reconnect Support**: 30-second grace window when a player loses connection; if the player returns within 30 seconds, their full state and clocks are restored seamlessly. If the window expires, the game is forfeited to the opponent.
- **Spectator Support**: Users joining an active room after both player slots are filled enter as spectators to watch moves and participate in chat.

## Note on Architecture & Validation Scope
To keep this minor project interview-friendly, clean, and honest:
- **State Storage**: Games are stored strictly **in-memory** in `GameManager` using thread-safe `ConcurrentHashMap`. No database, JPA, or Redis caching is required or claimed.
- **Move Validation**: Legal chess move generation, piece pinning, and checkmate detection are handled client-side using `chess.js`. The Spring Boot backend enforces:
  1. Active player turn ownership (`isPlayerTurn`), rejecting out-of-turn or spectator moves.
  2. Move coordinate validity (`^[a-h][1-8]$`, differing source and target).
  3. FEN notation integrity (6 standard tokens, 8 ranks, preservation of both Kings, and next-turn parity).
  4. Timer elapsed deductions and turn switching.
- **Authentication**: Matches rely on room codes and WebSocket session IDs rather than JWT/Spring Security to avoid unnecessary enterprise complexity.

## Tech Stack
- **Java**: Java 17+ (LTS)
- **Spring Boot**: Spring Boot 3.3.3 (`spring-boot-starter-web`, `spring-boot-starter-websocket`)
- **WebSocket**: Spring WebSocket with native WebSocket protocol
- **Maven**: Dependency and build management
- **HTML**: HTML5 semantic markup
- **CSS**: Vanilla CSS with custom design system and dark theme styling
- **JavaScript**: Vanilla ES6 JavaScript with native WebSocket adapter (`socket-adapter.js`) and `chess.js` client rule helper

## Architecture

```
Frontend (HTML / CSS / JavaScript)
         │
         │  WebSocket (JSON events over ws://localhost:3005/ws)
         ▼
Spring Boot WebSocket Config (WebSocketConfig.java)
         │
         ▼
Game WebSocket Controller (GameWebSocketController.java)
         │
    ┌────┴───────────────────────────┐
    ▼                                ▼
Game Service (GameService.java)   Game Timer Service (GameTimerService.java)
    │                                │
    └───────────────┬────────────────┘
                    ▼
Game Manager (GameManager.java)
                    │
                    ▼
In-Memory Game State (ConcurrentHashMap<String, GameRoom>)
```

### Component Responsibilities
- **`config/WebSocketConfig.java`**: Configures the WebSocket registry, registers the `/ws` endpoint, and configures cross-origin permissions.
- **`controller/GameWebSocketController.java`**: Manages active `WebSocketSession` connections, unmarshals incoming JSON events, routes actions, and provides broadcast/unicast messaging helpers.
- **`service/GameService.java`**: Implements core business logic—room generation, matchmaking, server-side turn validation, move coordinate checks, FEN integrity checks, chat, resignations, draws, rematches, and disconnection grace handling.
- **`service/GameTimerService.java`**: Operates background thread-pool scheduled executors to decrement active player clocks, emit periodic synchronization pulses, and detect timeouts.
- **`manager/GameManager.java`**: Thread-safe registry maintaining all active `GameRoom` instances using `ConcurrentHashMap`.
- **`model/`**: Clean domain entities:
  - `GameRoom.java`: Holds active players, clocks, current FEN, turn, and timer futures.
  - `Player.java`: Encapsulates session ID, assigned color, and connection status.
  - `GameState.java`: Complete snapshot DTO used for client synchronization.
  - `Move.java`: DTO representing a chess move (`from`, `to`, `piece`, `promotion`, `san`).
  - `ChatMessage.java`: In-game chat message model.
  - `WsMessage.java`: Inbound/outbound WebSocket envelope framing `{ event, data }`.

## Game Flow

```
Create Room
    ↓ (Generate unique 6-character room code)
Join Room
    ↓ (Player 1 and Player 2 connect via WebSocket)
Assign Color
    ↓ (First player assigned White, second player Black)
Start Game
    ↓ (Both clients receive game-start; server starts game clocks)
Player Move
    ↓ (Client sends move-made event to server)
Server Update
    ↓ (Server verifies player turn, move coordinates & FEN integrity, updates clocks, switches turn)
Broadcast State
    ↓ (Server sends move-update event to opponent and spectators)
Timer Update
    ↓ (Server decrements active player's clock; broadcasts time-sync pulses)
Game End
      (Checkmate, resignation, draw agreement, timeout, or disconnect abandonment)
```

## Project Structure

```
chess-multiplayer/
├── pom.xml
├── README.md
└── src/
    ├── main/
    │   ├── java/com/kingside/chess/
    │   │   ├── ChessApplication.java               # Spring Boot Application entrypoint
    │   │   ├── config/
    │   │   │   ├── WebConfig.java                  # Static resources & MVC routing
    │   │   │   └── WebSocketConfig.java            # WebSocket endpoint registration (/ws)
    │   │   ├── controller/
    │   │   │   ├── GameWebSocketController.java    # WebSocket message dispatch & routing
    │   │   │   └── PageController.java             # Web page routes (/ and /game)
    │   │   ├── manager/
    │   │   │   └── GameManager.java                # In-memory ConcurrentHashMap game storage
    │   │   ├── model/
    │   │   │   ├── ChatMessage.java                # Chat message DTO
    │   │   │   ├── GameRoom.java                   # Room state, players, and timers
    │   │   │   ├── GameState.java                  # State snapshot model for sync
    │   │   │   ├── Move.java                       # Move coordinate DTO
    │   │   │   ├── Player.java                     # Player session representation
    │   │   │   └── WsMessage.java                  # Envelope for WebSocket messages
    │   │   └── service/
    │   │       ├── GameService.java                # Game lifecycle, turn validation, matchmaking
    │   │       └── GameTimerService.java           # Chess clock threads & timeout flags
    │   └── resources/
    │       ├── application.properties              # Port 3005 and log settings
    │       └── static/
    │           ├── index.html                      # Matchmaking lobby page
    │           ├── game.html                       # Chess arena page
    │           ├── css/
    │           │   ├── main.css                    # Lobby styling
    │           │   └── game.css                    # Arena & board styling
    │           └── js/
    │               ├── socket-adapter.js           # Native WebSocket client adapter
    │               └── game.js                     # Chessboard interaction & engine logic
    └── test/
        └── java/com/kingside/chess/
            ├── ChessApplicationTests.java          # Context loading test
            ├── manager/GameManagerTest.java        # Room management tests
            └── service/
                ├── GameServiceTest.java            # Turn enforcement, validation & matchmaking tests
                └── GameTimerServiceTest.java       # Clock ticking & flag tests
```

## How to Run

### 1. Prerequisites
- **Java Development Kit (JDK) 17** or newer installed (`java -version`)
- **Apache Maven 3.8+** installed (`mvn -version`)

### 2. Build the Project
Compile classes and execute all automated test suites:
```bash
mvn clean test
```

Package the executable Spring Boot JAR:
```bash
mvn clean package
```

### 3. Start the Server
Run directly using the Spring Boot Maven plugin:
```bash
mvn spring-boot:run
```
Or run the packaged JAR:
```bash
java -jar target/chess-multiplayer-1.0.0.jar
```

The application starts on port `3005` by default.

### 4. Open the Application
Open your web browser and navigate to:
- **Lobby**: `http://localhost:3005/`
- **Arena (Direct)**: `http://localhost:3005/game`

To test multiplayer, open two separate browser windows (or an Incognito window) to `http://localhost:3005/`:
1. Player 1 selects time control, clicks **Create Room & Invite**, and copies the 6-digit Room ID.
2. Player 2 enters the Room ID in **Join Match** and clicks Join.
3. The match starts automatically with clocks ticking and turn enforcement active.

## WebSocket Communication

Client and server communicate via a standard WebSocket connection at `ws://localhost:3005/ws` using structured JSON messages formatted as `{ "event": "<event-name>", "data": { ... } }`.

### Client to Server Events
| Event | Payload | Purpose |
|---|---|---|
| `create-game` | `{ "timeLimit": 5 }` | Request a new room code with optional clock limit in minutes |
| `join-game` | `{ "roomId": "ABC123" }` | Validate room code existence from the lobby before redirecting |
| `join-game-room` | `{ "roomId": "ABC123", "color": "white" }` | Register session in room; triggers game start when 2 players connect |
| `move-made` | `{ "roomId": "ABC123", "move": {...}, "fen": "..." }` | Submit a move for server turn verification and broadcast |
| `chat-message` | `{ "roomId": "ABC123", "message": "Good luck!" }` | Send an in-game text message to the room |
| `resign` | `{ "roomId": "ABC123" }` | Concede match, awarding win to opponent |
| `draw-offer` | `{ "roomId": "ABC123" }` | Send draw proposal to opponent |
| `draw-response` | `{ "roomId": "ABC123", "accepted": true }` | Accept or decline draw proposal |
| `rematch-offer` | `{ "roomId": "ABC123" }` | Propose rematch to opponent |
| `rematch-response` | `{ "roomId": "ABC123", "accepted": true }` | Accept rematch (swaps player colors and resets clocks) |
| `game-ended` | `{ "roomId": "ABC123", "reason": "checkmate", "winner": "white" }` | Report client-detected terminal states |

### Server to Client Events
| Event | Payload | Purpose |
|---|---|---|
| `_connection_ack` | `{ "socketId": "<session-id>" }` | Acknowledge connection and provide session ID |
| `game-created` | `{ "roomId": "ABC123" }` | Return generated room code to creator |
| `game-joined` | `{ "roomId": "ABC123" }` | Confirm room entry validity |
| `color-assigned` | `{ "color": "white" }` | Confirm assigned role (white, black, or spectator) |
| `waiting-for-opponent` | `{}` | Inform first player that room is waiting for opponent |
| `game-start` | `{ "timeLimit": 5, "timerW": 300000, "timerB": 300000 }` | Signal that both players joined and clocks started |
| `move-update` | `{ "move": {...}, "fen": "...", "timerW": ..., "timerB": ..., "currentTurn": "b" }` | Broadcast validated move and switched turn to room |
| `time-sync` | `{ "timerW": 298500, "timerB": 300000 }` | Periodic clock broadcast ensuring synced UI timers |
| `chat-message-received` | `{ "senderColor": "white", "text": "...", "timestamp": ... }` | Broadcast chat message to room |
| `draw-offered` / `draw-declined` | `{ "color": "white" }` | Notify opponent of draw proposal status |
| `rematch-offered` / `rematch-declined` | `{ "color": "white" }` | Notify opponent of rematch proposal status |
| `rematch-start` | `{ "color": "black", "timeLimit": 5, "timerW": 300000, "timerB": 300000 }` | Notify players of rematch start with swapped colors |
| `player-disconnected-countdown` | `{ "color": "white", "seconds": 30 }` | Notify opponent of 30-second reconnection grace period |
| `player-reconnected` | `{ "color": "white" }` | Notify opponent that disconnected player rejoined |
| `reconnected-state` | `{ GameState snapshot }` | Restore full board, clocks, turn, and chat to reconnected player |
| `game-over` | `{ "reason": "timeout|resign|checkmate|abandoned", "winner": "white" }` | Broadcast final match outcome and stop clocks |

## Future Improvements
- **Persistent Game History**: Integrate Spring Data JPA / PostgreSQL to persist user game histories and PGN notation across server restarts.
- **User Authentication**: Implement Spring Security with JWT tokens for user profiles, rating records, and game statistics.
- **Distributed State with Redis**: Transition `GameManager` in-memory maps to Redis Hash structures and Pub/Sub to allow horizontal scaling across multiple Spring Boot instances.
- **Full Server-Side Chess Engine**: Integrate a Java chess rule engine (such as `chesslib`) on the backend to validate move legality on the server independent of client-side validation.
- **WebSocket Clustering**: Use STOMP with a shared RabbitMQ or Redis message broker for cross-node player matchmaking.
