const games = {};

function createGame(roomId, timeLimit = null) {
  // timeLimit is in minutes
  const durationMs = timeLimit ? timeLimit * 60 * 1000 : null;
  
  games[roomId] = {
    players: [],
    fen: null,
    currentTurn: "w",
    timeLimit: timeLimit,
    timerW: durationMs,
    timerB: durationMs,
    lastMoveTime: null,
    gameStarted: false,
    gameOver: false,
    chatHistory: [],
    disconnectTimers: {},
    timerInterval: null
  };
  return games[roomId];
}

function getGame(roomId) {
  return games[roomId];
}

function addPlayerToGame(roomId, socketId, color) {
  const game = games[roomId];
  if (game) {
    // Prevent adding if already there
    const exists = game.players.find(p => p.id === socketId);
    if (!exists) {
      game.players.push({ id: socketId, color });
    }
  }
}

function removePlayerFromGame(socketId) {
  for (const roomId in games) {
    const game = games[roomId];
    game.players = game.players.filter((p) => p.id !== socketId);
    
    // Clear dynamic intervals/timers if they exist
    if (game.disconnectTimers[socketId]) {
      clearTimeout(game.disconnectTimers[socketId]);
      delete game.disconnectTimers[socketId];
    }

    if (game.players.length === 0) {
      if (game.timerInterval) {
        clearInterval(game.timerInterval);
      }
      delete games[roomId];
      console.log(`🗑️ Game ${roomId} deleted`);
    }
  }
}

function findRoomByPlayerId(socketId) {
  for (const roomId in games) {
    const found = games[roomId].players.find((p) => p.id === socketId);
    if (found) return roomId;
  }
  return null;
}

module.exports = {
  games,
  createGame,
  getGame,
  addPlayerToGame,
  removePlayerFromGame,
  findRoomByPlayerId
};