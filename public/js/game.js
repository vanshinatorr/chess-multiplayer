const socket = io();

// URL se room ID aur color nikalo
const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");
const myColor = params.get("color"); // "white" or "black"

// Chess pieces unicode map
const PIECES = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟"
};

// Game state
let selectedSquare = null;
let validMoves = [];
let gameActive = false;
let moveHistory = [];
let lastMove = null;
let chess = null;

// ── DOM REFS ──
const boardEl        = document.getElementById("board");
const gameStatusEl   = document.getElementById("gameStatus");
const turnIndicEl    = document.getElementById("turnIndicator");
const movesListEl    = document.getElementById("movesList");
const roomIdDisplay  = document.getElementById("roomIdDisplay");
const opponentColor  = document.getElementById("opponentColor");
const yourColorEl    = document.getElementById("yourColor");
const opponentStatus = document.getElementById("opponentStatus");
const copyBtn        = document.getElementById("copyBtn");
const resignBtn      = document.getElementById("resignBtn");

// ── INIT ──
roomIdDisplay.textContent = roomId;
yourColorEl.textContent   = myColor;
opponentColor.textContent = myColor === "white" ? "black" : "white";

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(roomId);
  copyBtn.textContent = "Copied!";
  setTimeout(() => copyBtn.textContent = "Copy", 1500);
});

resignBtn.addEventListener("click", () => {
  if (!gameActive) return;
  socket.emit("resign", { roomId });
});

// ── LOAD CHESS.JS ──
// chess.js CDN se load karenge dynamically
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js";
script.onload = () => {
  chess = new Chess();
  socket.emit("join-game-room", { roomId, color: myColor });
  renderBoard();
};
document.head.appendChild(script);

// ── RENDER BOARD ──
function renderBoard() {
  boardEl.innerHTML = "";
  const board = chess.board();

  // Black player ke liye board flip karo
  const rows    = myColor === "black" ? [...board].reverse() : board;
  const colsIdx = myColor === "black" ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  const files = ["a","b","c","d","e","f","g","h"];
  const ranks = ["8","7","6","5","4","3","2","1"];

  rows.forEach((row, rIdx) => {
    const actualRank = myColor === "black" ? rIdx : rIdx;
    const cols = colsIdx.map(c => row[c]);

    cols.forEach((piece, cIdx) => {
      const actualFile = myColor === "black" ? 7 - cIdx : cIdx;
      const rankNum    = myColor === "black" ? rIdx + 1 : 8 - rIdx;
      const fileChar   = files[actualFile];
      const squareName = fileChar + rankNum;

      const sq = document.createElement("div");
      const isLight = (actualFile + (8 - rankNum)) % 2 === 0;
      sq.classList.add("square", isLight ? "light" : "dark");
      sq.dataset.square = squareName;

      // Coordinates
      if (cIdx === 7) {
        const rank = document.createElement("span");
        rank.classList.add("coord", "rank");
        rank.textContent = rankNum;
        sq.appendChild(rank);
      }
      if (rIdx === 7) {
        const file = document.createElement("span");
        file.classList.add("coord", "file");
        file.textContent = fileChar;
        sq.appendChild(file);
      }

      // Last move highlight
      if (lastMove && (squareName === lastMove.from || squareName === lastMove.to)) {
        sq.classList.add("last-move");
      }

      // Selected highlight
      if (selectedSquare === squareName) {
        sq.classList.add("selected");
      }

      // Valid move dots
      if (validMoves.includes(squareName)) {
        const hasEnemy = chess.get(squareName) && chess.get(squareName).color !== chess.turn();
        sq.classList.add(hasEnemy ? "valid-capture" : "valid-move");
      }

      // Piece
      if (piece) {
        const key = piece.color + piece.type.toUpperCase();
        const pieceEl = document.createElement("span");
        pieceEl.classList.add("piece");
        pieceEl.textContent = PIECES[key];
        sq.appendChild(pieceEl);
      }

      sq.addEventListener("click", () => handleSquareClick(squareName));
      boardEl.appendChild(sq);
    });
  });
}

// ── HANDLE CLICK ──
function handleSquareClick(squareName) {
  if (!gameActive) return;

  const myTurn = (chess.turn() === "w" && myColor === "white") ||
                 (chess.turn() === "b" && myColor === "black");

  if (!myTurn) return;

  const piece = chess.get(squareName);

  // Agar apna piece click kiya
  if (piece && piece.color === chess.turn()) {
    selectedSquare = squareName;
    const moves = chess.moves({ square: squareName, verbose: true });
    validMoves = moves.map(m => m.to);
    renderBoard();
    return;
  }

  // Agar valid move pe click kiya
  if (selectedSquare && validMoves.includes(squareName)) {
    makeMove(selectedSquare, squareName);
    return;
  }

  // Kuch aur click kiya — deselect
  selectedSquare = null;
  validMoves = [];
  renderBoard();
}

// ── MAKE MOVE ──
function makeMove(from, to) {
  // Pawn promotion check
  const piece = chess.get(from);
  let promotion = undefined;
  if (piece && piece.type === "p") {
    const rank = to[1];
    if ((piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1")) {
      promotion = "q"; // auto queen
    }
  }

  const move = chess.move({ from, to, promotion });
  if (!move) return;

  lastMove = { from, to };
  selectedSquare = null;
  validMoves = [];

  // Move history update
  moveHistory.push(move.san);
  updateMoveHistory();
  updateTurnIndicator();

  // Server ko move bhejo
  socket.emit("move-made", {
    roomId,
    move: { from, to, promotion },
    fen: chess.fen()
  });

  renderBoard();
  checkGameOver();
}

// ── MOVE HISTORY ──
function updateMoveHistory() {
  movesListEl.innerHTML = "";
  for (let i = 0; i < moveHistory.length; i += 2) {
    const row = document.createElement("div");
    row.classList.add("move-row");
    row.innerHTML = `
      <span class="move-num">${Math.floor(i/2)+1}.</span>
      <span class="move-white">${moveHistory[i] || ""}</span>
      <span class="move-black">${moveHistory[i+1] || ""}</span>
    `;
    movesListEl.appendChild(row);
  }
  movesListEl.scrollTop = movesListEl.scrollHeight;
}

// ── TURN INDICATOR ──
function updateTurnIndicator() {
  if (!gameActive) return;
  const turn = chess.turn() === "w" ? "White" : "Black";
  const isMyTurn = (chess.turn() === "w" && myColor === "white") ||
                   (chess.turn() === "b" && myColor === "black");
  turnIndicEl.textContent = isMyTurn ? "Your turn" : `${turn}'s turn`;
}

// ── GAME OVER CHECK ──
function checkGameOver() {
  if (chess.in_checkmate()) {
    const winner = chess.turn() === "w" ? "Black" : "White";
    showModal("Checkmate!", `${winner} wins the game.`);
    gameActive = false;
  } else if (chess.in_draw()) {
    showModal("Draw!", "The game ended in a draw.");
    gameActive = false;
  } else if (chess.in_check()) {
    gameStatusEl.textContent = "Check!";
  }
}

// ── MODAL ──
function showModal(title, msg) {
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");
  overlay.innerHTML = `
    <div class="modal">
      <h2>${title}</h2>
      <p>${msg}</p>
      <button class="modal-btn" onclick="window.location.href='/'">Back to Lobby</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ── SOCKET EVENTS ──
socket.on("connect", () => {
  document.getElementById("connDot").classList.add("connected");
  document.getElementById("connText").textContent = "Connected";
});

socket.on("disconnect", () => {
  document.getElementById("connDot").classList.remove("connected");
  document.getElementById("connText").textContent = "Disconnected";
});

socket.on("game-start", () => {
  gameActive = true;
  gameStatusEl.textContent = "Game in progress";
  gameStatusEl.classList.add("active");
  opponentStatus.textContent = "Online";
  opponentStatus.classList.add("active");
  updateTurnIndicator();
});

socket.on("move-update", ({ move, fen }) => {
  chess.load(fen);
  lastMove = { from: move.from, to: move.to };
  moveHistory.push(chess.history().pop() || move.to);
  updateMoveHistory();
  updateTurnIndicator();
  renderBoard();
  checkGameOver();
});

socket.on("player-disconnected", () => {
  opponentStatus.textContent = "Disconnected";
  opponentStatus.classList.remove("active");
  gameStatusEl.textContent = "Opponent disconnected";
  showModal("Opponent Left", "Your opponent disconnected from the game.");
  gameActive = false;
});

socket.on("game-resigned", ({ color }) => {
  showModal("Game Over", `${color} resigned. You win!`);
  gameActive = false;
});