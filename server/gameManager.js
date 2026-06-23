const games = {};

function createGame(roomId) {
  games[roomId] = {
    players: [],
    fen: null,
    currentTurn: "w"
  };
  return games[roomId];
}

function getGame(roomId) {
  return games[roomId];
}

function addPlayerToGame(roomId, socketId, color) {
  if (games[roomId]) {
    games[roomId].players.push({ id: socketId, color });
  }
}

function removePlayerFromGame(socketId) {
  for (const roomId in games) {
    games[roomId].players = games[roomId].players.filter(
      (p) => p.id !== socketId
    );
    if (games[roomId].players.length === 0) {
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
  createGame,
  getGame,
  addPlayerToGame,
  removePlayerFromGame,
  findRoomByPlayerId
};