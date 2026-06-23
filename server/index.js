const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { handleSocketEvents } = require("./socketHandlers");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/game.html"));
});

io.on("connection", (socket) => {
  console.log(`✅ Player connected: ${socket.id}`);
  handleSocketEvents(io, socket);
});

server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});