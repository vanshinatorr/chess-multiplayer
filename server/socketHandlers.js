const { v4: uuidv4 } = require("uuid");
const {
  createGame,
  getGame,
  addPlayerToGame,
  removePlayerFromGame,
  findRoomByPlayerId
} = require("./gameManager");

function startGameTimer(io, roomId) {
  const game = getGame(roomId);
  if (!game || !game.timeLimit || game.timerInterval) return;

  game.lastMoveTime = Date.now();

  game.timerInterval = setInterval(() => {
    if (game.gameOver) {
      clearInterval(game.timerInterval);
      return;
    }

    const now = Date.now();
    const elapsed = now - game.lastMoveTime;
    game.lastMoveTime = now;

    if (game.currentTurn === "w") {
      game.timerW = Math.max(0, game.timerW - elapsed);
      if (game.timerW <= 0) {
        game.gameOver = true;
        clearInterval(game.timerInterval);
        io.to(roomId).emit("game-over", { reason: "timeout", winner: "black" });
      }
    } else {
      game.timerB = Math.max(0, game.timerB - elapsed);
      if (game.timerB <= 0) {
        game.gameOver = true;
        clearInterval(game.timerInterval);
        io.to(roomId).emit("game-over", { reason: "timeout", winner: "white" });
      }
    }

    io.to(roomId).emit("time-sync", {
      timerW: game.timerW,
      timerB: game.timerB
    });
  }, 250);
}

function handleSocketEvents(io, socket) {

  socket.on("create-game", ({ timeLimit }) => {
    const roomId = uuidv4().slice(0, 6).toUpperCase();
    createGame(roomId, timeLimit ? parseInt(timeLimit) : null);
    console.log(`🎮 Game created: ${roomId} | Time control: ${timeLimit} min`);
    socket.emit("game-created", { roomId });
  });

  socket.on("join-game", ({ roomId }) => {
    const upperRoomId = roomId.toUpperCase().trim();
    const game = getGame(upperRoomId);

    if (!game) {
      socket.emit("error-message", { message: "Room not found!" });
      return;
    }
    if (game.players.length >= 2) {
      socket.emit("error-message", { message: "Room is full!" });
      return;
    }
    socket.emit("game-joined", { roomId: upperRoomId });
  });

  socket.on("join-game-room", ({ roomId, color, timeLimit }) => {
    const upperRoomId = roomId.toUpperCase().trim();
    let game = getGame(upperRoomId);

    if (!game) {
      game = createGame(upperRoomId, timeLimit ? parseInt(timeLimit) : null);
    }

    // Resolve color if "joiner"
    let resolvedColor = color;
    if (color === "joiner") {
      if (game.players.length === 0) {
        resolvedColor = "white";
      } else {
        const firstPlayerColor = game.players[0].color;
        resolvedColor = firstPlayerColor === "white" ? "black" : "white";
      }
    }

    // Check if player with this color was already in the room (reconnection)
    const existingPlayerIndex = game.players.findIndex(p => p.color === resolvedColor);

    if (existingPlayerIndex !== -1) {
      const oldPlayerId = game.players[existingPlayerIndex].id;
      
      // Update socket id
      game.players[existingPlayerIndex].id = socket.id;

      // Clear disconnection grace timer
      if (game.disconnectTimers[oldPlayerId]) {
        clearTimeout(game.disconnectTimers[oldPlayerId]);
        delete game.disconnectTimers[oldPlayerId];
        console.log(`🔄 Cleared disconnect timer for player ${resolvedColor} in ${upperRoomId}`);
      }

      socket.join(upperRoomId);
      
      // Send current game state so client can resume
      socket.emit("reconnected-state", {
        color: resolvedColor,
        fen: game.fen,
        timerW: game.timerW,
        timerB: game.timerB,
        chatHistory: game.chatHistory,
        timeLimit: game.timeLimit,
        gameStarted: game.gameStarted,
        gameOver: game.gameOver,
        currentTurn: game.currentTurn
      });

      socket.to(upperRoomId).emit("player-reconnected", { color: resolvedColor });
      return;
    }

    if (game.players.length >= 2) {
      socket.join(upperRoomId);
      console.log(`👁️ Player joined as spectator: ${socket.id} in room: ${upperRoomId}`);
      
      socket.emit("reconnected-state", {
        color: "spectator",
        fen: game.fen,
        timerW: game.timerW,
        timerB: game.timerB,
        chatHistory: game.chatHistory,
        timeLimit: game.timeLimit,
        gameStarted: game.gameStarted,
        gameOver: game.gameOver,
        currentTurn: game.currentTurn
      });
      return;
    }

    addPlayerToGame(upperRoomId, socket.id, resolvedColor);
    socket.join(upperRoomId);
    console.log(`✅ Player ${resolvedColor} joined room: ${upperRoomId}`);

    // Send resolved color to the client
    socket.emit("color-assigned", { color: resolvedColor });

    // If both players are in the room, start the game
    if (game.players.length >= 2) {
      game.gameStarted = true;
      io.to(upperRoomId).emit("game-start", {
        timeLimit: game.timeLimit,
        timerW: game.timerW,
        timerB: game.timerB
      });
      startGameTimer(io, upperRoomId);
    } else {
      socket.emit("waiting-for-opponent");
    }
  });

  socket.on("move-made", ({ roomId, move, fen }) => {
    const game = getGame(roomId);
    if (!game || game.gameOver) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    if (game.timeLimit && game.lastMoveTime) {
      const now = Date.now();
      const elapsed = now - game.lastMoveTime;
      game.lastMoveTime = now;

      if (game.currentTurn === "w") {
        game.timerW = Math.max(0, game.timerW - elapsed);
      } else {
        game.timerB = Math.max(0, game.timerB - elapsed);
      }
    }

    game.fen = fen;
    game.currentTurn = game.currentTurn === "w" ? "b" : "w";

    // Send update to the other player
    socket.to(roomId).emit("move-update", {
      move,
      fen,
      timerW: game.timerW,
      timerB: game.timerB,
      currentTurn: game.currentTurn
    });
  });

  socket.on("resign", ({ roomId }) => {
    const game = getGame(roomId);
    if (!game || game.gameOver) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    game.gameOver = true;
    if (game.timerInterval) clearInterval(game.timerInterval);

    const winnerColor = player.color === "white" ? "black" : "white";
    io.to(roomId).emit("game-over", { reason: "resign", winner: winnerColor, loser: player.color });
  });

  socket.on("chat-message", ({ roomId, message }) => {
    const game = getGame(roomId);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    const chatMsg = {
      senderColor: player.color,
      text: message,
      timestamp: Date.now()
    };

    game.chatHistory.push(chatMsg);
    io.to(roomId).emit("chat-message-received", chatMsg);
  });

  socket.on("draw-offer", ({ roomId }) => {
    const game = getGame(roomId);
    if (!game || game.gameOver) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    socket.to(roomId).emit("draw-offered", { color: player.color });
  });

  socket.on("draw-response", ({ roomId, accepted }) => {
    const game = getGame(roomId);
    if (!game || game.gameOver) return;

    if (accepted) {
      game.gameOver = true;
      if (game.timerInterval) clearInterval(game.timerInterval);
      io.to(roomId).emit("game-over", { reason: "draw-agreement" });
    } else {
      socket.to(roomId).emit("draw-declined");
    }
  });

  socket.on("rematch-offer", ({ roomId }) => {
    const game = getGame(roomId);
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    socket.to(roomId).emit("rematch-offered", { color: player.color });
  });

  socket.on("rematch-response", ({ roomId, accepted }) => {
    const game = getGame(roomId);
    if (!game) return;

    if (accepted) {
      game.gameOver = false;
      game.gameStarted = true;
      game.fen = null;
      game.currentTurn = "w";
      
      const durationMs = game.timeLimit ? game.timeLimit * 60 * 1000 : null;
      game.timerW = durationMs;
      game.timerB = durationMs;
      game.lastMoveTime = null;
      game.chatHistory = [];

      if (game.players.length === 2) {
        const p1 = game.players[0];
        const p2 = game.players[1];
        const tempColor = p1.color;
        p1.color = p2.color;
        p2.color = tempColor;
        console.log(`🔄 Rematch: colors swapped. Player 1: ${p1.color}, Player 2: ${p2.color}`);
      }

      if (game.timerInterval) clearInterval(game.timerInterval);

      game.players.forEach(p => {
        io.to(p.id).emit("rematch-start", {
          color: p.color,
          timeLimit: game.timeLimit,
          timerW: game.timerW,
          timerB: game.timerB
        });
      });

      startGameTimer(io, roomId);
    } else {
      socket.to(roomId).emit("rematch-declined");
    }
  });

  socket.on("game-ended", ({ roomId, reason, winner }) => {
    const game = getGame(roomId);
    if (!game || game.gameOver) return;

    game.gameOver = true;
    if (game.timerInterval) clearInterval(game.timerInterval);
    io.to(roomId).emit("game-over", { reason, winner });
  });

  socket.on("disconnect", () => {
    const roomId = findRoomByPlayerId(socket.id);
    if (roomId) {
      const game = getGame(roomId);
      if (game && !game.gameOver) {
        const player = game.players.find(p => p.id === socket.id);
        if (player) {
          console.log(`⚠️ Player ${player.color} disconnected. Starting 30s reconnect window.`);
          
          socket.to(roomId).emit("player-disconnected-countdown", {
            color: player.color,
            seconds: 30
          });

          game.disconnectTimers[socket.id] = setTimeout(() => {
            console.log(`❌ Timeout: Player ${player.color} failed to reconnect to ${roomId}`);
            game.gameOver = true;
            if (game.timerInterval) clearInterval(game.timerInterval);
            
            const winnerColor = player.color === "white" ? "black" : "white";
            io.to(roomId).emit("game-over", { reason: "abandoned", winner: winnerColor });

            removePlayerFromGame(socket.id);
          }, 30000);
        }
      } else {
        removePlayerFromGame(socket.id);
      }
    } else {
      removePlayerFromGame(socket.id);
    }
    console.log(`❌ Player socket closed: ${socket.id}`);
  });
}

module.exports = { handleSocketEvents };