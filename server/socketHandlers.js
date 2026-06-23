const { v4: uuidv4 } = require("uuid");
const {
  createGame,
  getGame,
  addPlayerToGame,
  removePlayerFromGame,
  findRoomByPlayerId
} = require("./gameManager");

function handleSocketEvents(io, socket) {

  socket.on("create-game", () => {
    const roomId = uuidv4().slice(0, 6).toUpperCase();
    createGame(roomId);
    console.log(`🎮 Game created: ${roomId}`);
    socket.emit("game-created", { roomId });
  });

  socket.on("join-game", ({ roomId }) => {
    const upperRoomId = roomId.toUpperCase().trim();
    const game = getGame(upperRoomId);
    console.log(`🔍 Join attempt: ${upperRoomId}`, game);

    if (!game) {
      socket.emit("error-message", { message: "Room nahi mila!" });
      return;
    }
    if (game.players.length >= 2) {
      socket.emit("error-message", { message: "Room full hai!" });
      return;
    }
    socket.emit("game-joined", { roomId: upperRoomId });
  });

  // Yeh event game page load hone pe fire hoga
  socket.on("join-game-room", ({ roomId, color }) => {
    const upperRoomId = roomId.toUpperCase().trim();
    const game = getGame(upperRoomId);

    if (!game) {
      // Room nahi mila — create karo agar white hai
      if (color === "white") {
        createGame(upperRoomId);
      } else {
        return;
      }
    }

    // Player already hai toh mat add karo
    const alreadyIn = game
      ? game.players.find(p => p.id === socket.id)
      : false;

    if (!alreadyIn) {
      addPlayerToGame(upperRoomId, socket.id, color);
    }

    socket.join(upperRoomId);
    console.log(`✅ ${color} joined room: ${upperRoomId} | Players: ${getGame(upperRoomId).players.length}`);

    // Dono aa gaye toh game start
    if (getGame(upperRoomId).players.length >= 2) {
      io.to(upperRoomId).emit("game-start");
    }
  });

  socket.on("move-made", ({ roomId, move, fen }) => {
    const game = getGame(roomId);
    if (!game) return;
    game.fen = fen;
    socket.to(roomId).emit("move-update", { move, fen });
  });

  socket.on("resign", ({ roomId }) => {
    const game = getGame(roomId);
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    io.to(roomId).emit("game-resigned", { color: player.color });
  });

  socket.on("disconnect", () => {
    const roomId = findRoomByPlayerId(socket.id);
    if (roomId) {
      socket.to(roomId).emit("player-disconnected");
    }
    removePlayerFromGame(socket.id);
    console.log(`❌ Player disconnected: ${socket.id}`);
  });
}

module.exports = { handleSocketEvents };