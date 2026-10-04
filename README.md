# Kingside — Real-Time Multiplayer Chess

A full-stack, real-time multiplayer chess platform built with **Java**, **Spring Boot**, and **WebSockets**.

Kingside allows players to create custom rooms, match with opponents via 6-character room codes, and play synchronized chess matches with live game clocks, in-game chat, and reconnection recovery.

---

## Highlights

- **Low-Latency Gameplay**: Native WebSocket connection (`/ws`) provides bidirectional, event-driven communication without HTTP polling overhead.
- **Room-Based Matchmaking**: Instant room generation with configurable clock controls (Blitz 3m/5m, Rapid 10m, Classical 30m, or Unlimited).
- **Server-Managed Turns & Clocks**: The server controls game clocks and turn progression, preventing out-of-turn moves and handling flag timeouts automatically.
- **Disconnect & Reconnect Grace Period**: If a player loses connection mid-game, the server holds their seat and clocks for 30 seconds, restoring the board upon reconnect.
- **In-Memory Concurrency**: Active games and player sessions are managed entirely in-memory using thread-safe data structures (`ConcurrentHashMap`, `CopyOnWriteArrayList`).
- **Zero External Dependencies**: Self-contained backend—no external database or message broker setup needed to run locally.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Java 17+, Spring Boot 3.3.3, Spring WebSocket |
| **Build & Tooling** | Apache Maven |
| **Frontend** | HTML5, Vanilla CSS3 (Custom Design System), JavaScript (ES6) |
| **Chess Rules Helper** | `chess.js` (client-side board state & legal move generation) |

---

## Features

### 1. Matchmaking & Room Management
- Generate a unique 6-character room code with a chosen time control.
- Opponent joins by entering the room code.
- Automatic side assignment: Player 1 is assigned White (or preferred color), Player 2 is assigned Black.
- Additional connections enter as **Spectators** who can follow the match and participate in room chat.

### 2. Turn Management & State Synchronization
- Server checks that only the active player makes a move (`currentTurn` check).
- Validates move notation (`[a-h][1-8]` coordinates) and verifies FEN integrity (valid structure, 8 ranks, Kings preserved, matching next-turn indicator).
- Updates board FEN, switches turn, and broadcasts the updated state to opponent and spectators.

### 3. Server-Side Game Clocks
- Clock ticking is driven by a scheduled daemon thread pool (`ScheduledExecutorService`).
- Only the active player's clock decreases.
- Periodic `time-sync` events keep browser clocks in sync with the server.
- Flags automatically when a player's timer reaches zero, ending the match and declaring the winner.

### 4. Disconnect & Reconnect Handling
- Detects socket closure (`afterConnectionClosed`) and starts a 30-second countdown for the missing player.
- The remaining player is notified with a live countdown banner.
- If the player reconnects within 30 seconds, the server cancels the countdown and sends a complete `reconnected-state` snapshot (board position, remaining clocks, turn, and chat).
- If the 30 seconds expire without reconnecting, the match is forfeited to the remaining player.

### 5. In-Game Interactions
- Real-time in-game text chat.
- Resignation flow with immediate winner declaration.
- Draw offer and response workflow.
- Rematch proposal with color swapping and clock resets.

---

## System Architecture

```
Browser Client (HTML / CSS / JS)
       │
       │ WebSocket (JSON envelopes over ws://localhost:3005/ws)
       ▼
WebSocketConfig (/ws endpoint registry)
       │
       ▼
GameWebSocketController (Session tracking, event parsing, room broadcasts)
       │
   ┌───┴────────────────────────┐
   ▼                            ▼
GameService                  GameTimerService
(Matchmaking, moves,         (Clock intervals, periodic sync,
turn enforcement)             flag timeouts)
   │                            │
   └───┬────────────────────────┘
       ▼
GameManager (ConcurrentHashMap<String, GameRoom>)
       │
       ▼
In-Memory Game State (Rooms, Players, FEN, Clocks, Chat)
```

### Key Classes

- **`WebSocketConfig`**: Registers the `/ws` endpoint with allowed origins for WebSocket handshakes.
- **`GameWebSocketController`**: Handles inbound text frames, maps incoming event types, tracks active sessions, and sends targeted/room-wide broadcasts.
- **`GameService`**: Contains core match logic—generates room codes, resolves colors, validates player turns, applies moves, updates timers, and coordinates disconnects.
- **`GameTimerService`**: Manages background thread scheduling for chess clocks and flags games on timeout.
- **`GameManager`**: Stores all active `GameRoom` instances in a thread-safe `ConcurrentHashMap`.
- **`GameRoom`**: Holds all room data: connected players, current FEN, active turn, clocks, and chat logs.
- **`GameState`**: State snapshot DTO delivered to reconnecting players or spectators.
- **`Move`**: Coordinates DTO (`from`, `to`, `piece`, `promotion`, `san`).

---

## WebSocket Events

All communication between client and server follows a consistent JSON format:
```json
{
  "event": "event-name",
  "data": { ... }
}
```

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `create-game` | `{ "timeLimit": 5 }` | Request a new room code with optional time control (minutes) |
| `join-game` | `{ "roomId": "ABC123" }` | Check room availability from the lobby |
| `join-game-room` | `{ "roomId": "ABC123", "color": "white" }` | Join room; triggers game start when 2 players connect |
| `move-made` | `{ "roomId": "ABC123", "move": {...}, "fen": "..." }` | Submit a move for server validation and broadcast |
| `chat-message` | `{ "roomId": "ABC123", "message": "Good luck!" }` | Send a chat message |
| `resign` | `{ "roomId": "ABC123" }` | Forfeit the match |
| `draw-offer` | `{ "roomId": "ABC123" }` | Propose a draw to opponent |
| `draw-response` | `{ "roomId": "ABC123", "accepted": true }` | Accept or reject draw offer |
| `rematch-offer` | `{ "roomId": "ABC123" }` | Propose a rematch |
| `rematch-response` | `{ "roomId": "ABC123", "accepted": true }` | Accept rematch (swaps colors & resets clocks) |
| `game-ended` | `{ "roomId": "ABC123", "reason": "checkmate", "winner": "white" }` | Notify server of terminal board state |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `_connection_ack` | `{ "socketId": "..." }` | Confirms WebSocket connection and returns session ID |
| `game-created` | `{ "roomId": "ABC123" }` | Delivers generated room code |
| `color-assigned` | `{ "color": "white" }` | Informs player of assigned role (white, black, spectator) |
| `waiting-for-opponent` | `{}` | Sent to first player while waiting for opponent |
| `game-start` | `{ "timeLimit": 5, "timerW": 300000, "timerB": 300000 }` | Signals game start and initializes clocks |
| `move-update` | `{ "move": {...}, "fen": "...", "timerW": ..., "timerB": ..., "currentTurn": "b" }` | Broadcasts validated move to other room members |
| `time-sync` | `{ "timerW": 298500, "timerB": 300000 }` | Periodic clock update |
| `chat-message-received`| `{ "senderColor": "white", "text": "...", "timestamp": ... }` | Broadcasts new chat message |
| `player-disconnected-countdown` | `{ "color": "white", "seconds": 30 }` | Alerts opponent of 30s reconnect window |
| `player-reconnected` | `{ "color": "white" }` | Informs opponent that disconnected player returned |
| `reconnected-state` | `{ GameState snapshot }` | Restores full game state to reconnected client |
| `game-over` | `{ "reason": "...", "winner": "white" }` | Broadcasts match outcome (timeout, resign, mate, abandon) |

---

## Project Structure

```
chess-multiplayer/
├── pom.xml                                   # Maven dependencies & build configuration
├── README.md                                 # Project documentation
└── src/
    ├── main/
    │   ├── java/com/kingside/chess/
    │   │   ├── ChessApplication.java         # Spring Boot entry point
    │   │   ├── config/
    │   │   │   ├── WebConfig.java            # Static resource mappings & CORS
    │   │   │   └── WebSocketConfig.java      # Registers /ws WebSocket endpoint
    │   │   ├── controller/
    │   │   │   ├── GameWebSocketController.java  # WebSocket message routing & session tracking
    │   │   │   └── PageController.java       # HTML view forwarders (/ and /game)
    │   │   ├── manager/
    │   │   │   └── GameManager.java          # In-memory ConcurrentHashMap room store
    │   │   ├── model/
    │   │   │   ├── ChatMessage.java          # Chat DTO
    │   │   │   ├── GameRoom.java             # Room entity with active state & clocks
    │   │   │   ├── GameState.java            # Full state snapshot DTO
    │   │   │   ├── Move.java                 # Move coordinates DTO
    │   │   │   ├── Player.java               # Player model (session ID, color)
    │   │   │   └── WsMessage.java            # WebSocket message wrapper
    │   │   └── service/
    │   │       ├── GameService.java          # Matchmaking, turn enforcement, move processing
    │   │       └── GameTimerService.java     # Scheduled clock thread pool & timeout flags
    │   └── resources/
    │       ├── application.properties        # App settings (port 3005)
    │       └── static/                       # Frontend assets
    │           ├── index.html                # Lobby page
    │           ├── game.html                 # Arena game page
    │           ├── css/
    │           │   ├── main.css              # Lobby styles
    │           │   └── game.css              # Arena & chessboard styles
    │           └── js/
    │               ├── socket-adapter.js     # Native WebSocket client adapter
    │               └── game.js               # Chessboard logic & chess.js binding
    └── test/java/com/kingside/chess/
        ├── ChessApplicationTests.java        # Spring context load test
        ├── manager/GameManagerTest.java      # Room CRUD unit tests
        └── service/
            ├── GameServiceTest.java          # Turn enforcement & validation tests
            └── GameTimerServiceTest.java     # Clock ticking & flag timeout tests
```

---

## Getting Started

### Prerequisites
- **Java JDK 17** or higher (`java -version`)
- **Apache Maven 3.8+** (`mvn -version`)

### Build & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vanshinatorr/chess-multiplayer.git
   cd chess-multiplayer
   ```

2. **Run tests:**
   ```bash
   mvn clean test
   ```

3. **Start the application:**
   ```bash
   mvn spring-boot:run
   ```
   *(Or package and run the JAR directly)*:
   ```bash
   mvn clean package
   java -jar target/chess-multiplayer-1.0.0.jar
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3005`

### Testing Multiplayer Locally
1. Open `http://localhost:3005` in a browser window.
2. Select your time control, click **Create Room & Invite**, and copy the 6-character room code.
3. Open an **Incognito** window (or another browser) to `http://localhost:3005`.
4. Enter the room code into the **Join Match** input and click Join.
5. The game starts immediately with synchronized clocks and turn validation.

---

## Engineering Design Decisions

### Why WebSockets over REST?
In a real-time game like chess—especially with fast Blitz clocks (3-minute games)—HTTP polling introduces unacceptable latency, unnecessary request header overhead, and server load. WebSockets provide a persistent, bi-directional TCP channel. A player's move is pushed to the opponent in single-digit milliseconds.

### In-Memory State & Concurrency
Active games are stored in `ConcurrentHashMap<String, GameRoom>`. This gives $O(1)$ room lookups by room code and thread-safe operations across concurrent WebSocket sessions without database locking overhead. Player lists use `CopyOnWriteArrayList` to allow safe iteration during room broadcasts even if a player connects or disconnects concurrently.

### Turn & Move Validation
Legal move generation and piece movement rules run on the client using `chess.js`. To prevent tampering without adding a heavy server-side chess engine, the Spring Boot backend enforces:
1. **Turn ownership**: Rejects moves if the sender's color does not match `currentTurn`.
2. **Move coordinates**: Ensures `from` and `to` are valid squares (`a1` to `h8`) and not identical.
3. **FEN integrity**: Verifies 6 tokens, 8 ranks, king preservation, and next-turn parity.

### Server-Side Clocks
Instead of trusting client clocks, the server runs a `ScheduledExecutorService` that ticks at fixed intervals. Elapsed time is deducted from the active player's clock, and `time-sync` pulses are pushed to clients to keep UI clocks synchronized. When a player's clock hits zero, the server terminates the game and broadcasts the timeout win.

---

## Roadmap

- [ ] **Game History Persistence**: Store completed matches and PGN logs using PostgreSQL / Spring Data JPA.
- [ ] **User Accounts & ELO**: Authentication with Spring Security and player rating calculations.
- [ ] **Distributed State**: Redis Pub/Sub and caching for multi-node horizontal scaling.
- [ ] **Server-Side Engine**: Deep server-side move verification using a Java chess library (`chesslib`).
