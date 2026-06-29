const socket = io();

// URL parameters
const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");
let myColor = params.get("color") || "white"; // "white", "black", "joiner" or "spectator"
let timeLimit = null; // Stored in minutes
const isAIMode = params.get("mode") === "ai";
const aiDifficulty = params.get("difficulty") || "easy";

// Sound/Volume State
let audioVolume = 0.5;
let isMuted = false;
let selectedSoundPack = "classic";

// Sound Engine using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (isMuted) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  const volMultiplier = audioVolume;

  if (selectedSoundPack === "retro") {
    // Retro 8-Bit Arcade Synthesizer
    osc.type = 'square';
    if (type === 'move') {
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(220, now + 0.05);
      gainNode.gain.setValueAtTime(0.2 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'capture') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.08);
      gainNode.gain.setValueAtTime(0.3 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'check') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.04);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      gainNode.gain.setValueAtTime(0.2 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'game-over') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.24); // C6
      gainNode.gain.setValueAtTime(0.2 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } else if (selectedSoundPack === "cyber") {
    // Cyber Laser FX
    osc.type = 'sawtooth';
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    
    osc.disconnect(gainNode);
    osc.connect(filter);
    filter.connect(gainNode);

    if (type === 'move') {
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gainNode.gain.setValueAtTime(0.25 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'capture') {
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
      filter.frequency.setValueAtTime(1500, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      gainNode.gain.setValueAtTime(0.35 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'check') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
      gainNode.gain.setValueAtTime(0.2 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'game-over') {
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.7);
      filter.frequency.setValueAtTime(2000, now);
      filter.frequency.exponentialRampToValueAtTime(20, now + 0.7);
      gainNode.gain.setValueAtTime(0.3 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.75);
      osc.start(now);
      osc.stop(now + 0.75);
    }
  } else {
    // Default: Classic wood ticks
    osc.type = 'sine';
    if (type === 'move') {
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
      gainNode.gain.setValueAtTime(0.3 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'capture') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      gainNode.gain.setValueAtTime(0.4 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'check') {
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.setValueAtTime(680, now + 0.08);
      gainNode.gain.setValueAtTime(0.25 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'game-over') {
      osc.frequency.setValueAtTime(329.63, now); // E4
      osc.frequency.setValueAtTime(440, now + 0.15); // A4
      osc.frequency.setValueAtTime(554.37, now + 0.3); // C#5
      gainNode.gain.setValueAtTime(0.25 * volMultiplier, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  }
}

// Glassmorphic confirm popup replacing standard browser confirm boxes
function showCustomConfirm(title, message, onConfirm, onDecline = null) {
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");
  overlay.innerHTML = `
    <div class="modal-confirm-box">
      <h3 class="modal-confirm-title">${title}</h3>
      <p class="modal-confirm-desc">${message}</p>
      <div class="modal-confirm-buttons">
        <button class="modal-confirm-btn modal-confirm-accept" id="confirmYes">Confirm</button>
        <button class="modal-confirm-btn modal-confirm-decline" id="confirmNo">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#confirmYes").addEventListener("click", () => {
    document.body.removeChild(overlay);
    if (onConfirm) onConfirm();
  });

  overlay.querySelector("#confirmNo").addEventListener("click", () => {
    document.body.removeChild(overlay);
    if (onDecline) onDecline();
  });
}

let currentPieceSet = "cburnett";

// Standard Vector SVG Pieces dynamically loaded from Lichess CDN
function getPieceSvgMarkup(type, color) {
  const pColor = color === 'w' ? 'w' : 'b';
  const pieceCode = pColor + type.toUpperCase();
  const url = `https://lichess1.org/assets/piece/${currentPieceSet}/${pieceCode}.svg`;
  
  return `<img src="${url}" class="piece animate-piece" alt="${pieceCode}" draggable="false" />`;
}

// Game State
let selectedSquare = null;
let validMoves = [];
let gameActive = false;
let moveHistory = [];
let lastMove = null;
let chess = null;

// Clock values
let timerW = null;
let timerB = null;
let clockInterval = null;

// Timeline History Navigation Cache
let fenHistory = []; // Array of { fen, lastMove }
let inHistoryReview = false;

// Promotion State
let promotionPending = null; // Stores { from, to }

// DOM REFS
const boardEl          = document.getElementById("board");
const gameStatusEl     = document.getElementById("gameStatus");
const turnIndicator    = document.getElementById("turnIndicator");
const turnCardEl       = document.getElementById("turnIndicatorCard");
const movesListEl      = document.getElementById("movesList");
const roomIdDisplay    = document.getElementById("roomIdDisplay");
const copyBtn          = document.getElementById("copyBtn");
const drawBtn          = document.getElementById("drawBtn");
const resignBtn        = document.getElementById("resignBtn");

// Panel DOM refs
const opponentPanel    = document.getElementById("opponentPanel");
const yourPanel        = document.getElementById("yourPanel");
const opponentName     = document.getElementById("opponentName");
const opponentStatus   = document.getElementById("opponentStatus");
const yourStatus       = document.getElementById("yourStatus");
const opponentClock    = document.getElementById("opponentClock");
const yourClock        = document.getElementById("yourClock");

const oppBadge         = document.getElementById("opponentColorBadge");
const youBadge         = document.getElementById("yourColorBadge");
const oppAvatar        = document.getElementById("opponentAvatar");
const youAvatar        = document.getElementById("yourAvatar");

const opponentCapturedEl = document.getElementById("opponentCaptured");
const yourCapturedEl     = document.getElementById("yourCaptured");
const materialBalanceEl  = document.getElementById("materialBalance");

// Evaluation Bar DOM refs
const evalBarFill      = document.getElementById("evalBarFill");
const evalBarText      = document.getElementById("evalBarText");

// Practice Hint DOM refs
const hintBtn          = document.getElementById("hintBtn");

// Promotion DOM refs
const promotionOverlay = document.getElementById("promotionOverlay");

// Timeline DOM refs
const timelineBanner   = document.getElementById("timelineBanner");
const timelineLiveBtn  = document.getElementById("timelineLiveBtn");

// Volume DOM refs
const volumeSlider     = document.getElementById("volumeSlider");
const volumeMuteBtn    = document.getElementById("volumeMuteBtn");
const soundPackSelect  = document.getElementById("soundPackSelect");

// Reconnect references
const reconnectBanner  = document.getElementById("reconnectBanner");
const reconnectText    = document.getElementById("reconnectCountdown");
let reconnectTimeLeft  = 30;
let reconnectInterval  = null;

// Init Display basic parameters
roomIdDisplay.textContent = roomId;

// Copy Room Link function
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(roomId);
  copyBtn.textContent = "✓";
  setTimeout(() => copyBtn.textContent = "📋", 1500);
});

// Setup dynamic panel displays
function initPlayerCards() {
  if (!myColor) return;

  const isSpectator = myColor === "spectator";
  const isWhite = myColor === "white";

  if (isSpectator) {
    youBadge.textContent = "Spectator (Observing)";
    oppBadge.textContent = "Multiplayer Arena";
    youAvatar.textContent = "👁️";
    oppAvatar.textContent = "⚔️";
    yourPanel.className = "player-panel you panel-spectator";
    opponentPanel.className = "player-panel opponent panel-spectator";
    
    // Disable in-game actions
    drawBtn.style.display = "none";
    resignBtn.style.display = "none";
    boardEl.classList.add("board-disabled");
  } else {
    youBadge.textContent = isWhite ? "Playing White" : "Playing Black";
    oppBadge.textContent = isWhite ? "Playing Black" : "Playing White";
    youAvatar.textContent = isWhite ? "♔" : "♚";
    oppAvatar.textContent = isWhite ? "♚" : "♔";
    yourPanel.className = "player-panel you " + (isWhite ? "panel-white" : "panel-black");
    opponentPanel.className = "player-panel opponent " + (isWhite ? "panel-black" : "panel-white");
  }

  if (isAIMode) {
    opponentName.textContent = "Kingside Engine (AI)";
    opponentStatus.textContent = "Lvl " + (aiDifficulty === "easy" ? "1" : aiDifficulty === "medium" ? "2" : "3");
    opponentStatus.className = "status-tag";
    hintBtn.style.display = "inline-block"; // Show AI practice hints button
  }
}

// Action Button Bindings
drawBtn.addEventListener("click", () => {
  if (!gameActive || myColor === "spectator") return;
  if (isAIMode) {
    addSystemChatMessage("AI declines draw offer. Practice requires combat!");
    return;
  }
  socket.emit("draw-offer", { roomId });
  addSystemChatMessage("You offered a draw.");
  drawBtn.disabled = true;
  setTimeout(() => {
    if (gameActive) drawBtn.disabled = false;
  }, 10000);
});

resignBtn.addEventListener("click", () => {
  if (!gameActive || myColor === "spectator") return;
  showCustomConfirm(
    "Resign Game",
    "Are you sure you want to resign and forfeit the match?",
    () => {
      if (isAIMode) {
        handleLocalGameOver("Defeat", "You resigned from the arena skirmish.", false);
      } else {
        socket.emit("resign", { roomId });
      }
    }
  );
});

// AI practice hints selector
hintBtn.addEventListener("click", () => {
  if (!gameActive || !isAIMode || inHistoryReview) return;
  
  // Calculate best move for the active side
  const hint = getBestMove(chess, "hard", chess.turn());
  if (hint) {
    // Play sound click feedback
    playSound('move');
    
    // Highlight squares
    document.querySelectorAll(".square").forEach(sq => {
      const squareName = sq.dataset.square;
      if (squareName === hint.from) sq.classList.add("hint-from");
      if (squareName === hint.to) sq.classList.add("hint-to");
    });

    // Clear after 3 seconds
    setTimeout(() => {
      document.querySelectorAll(".square").forEach(sq => {
        sq.classList.remove("hint-from", "hint-to");
      });
    }, 3000);
  }
});

// Load chess.js engine dynamically
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js";
script.onload = () => {
  chess = new Chess();
  
  // Cache initial position in timeline
  fenHistory = [{ fen: chess.fen(), lastMove: null }];
  
  if (isAIMode) {
    // Local AI Mode Setup
    gameActive = true;
    timeLimit = params.get("timeLimit") ? parseInt(params.get("timeLimit")) : 5;
    
    // Set timers (milliseconds)
    timerW = timeLimit * 60 * 1000;
    timerB = timeLimit * 60 * 1000;

    initPlayerCards();
    updateClockDisplay("white", timerW);
    updateClockDisplay("black", timerB);
    startClockTicker();
    
    drawBtn.disabled = false;
    resignBtn.disabled = false;
    gameStatusEl.textContent = "Practice Skirmish";
    gameStatusEl.className = "game-status-bubble active";
    opponentStatus.textContent = "Lvl " + (aiDifficulty === "easy" ? "1" : aiDifficulty === "medium" ? "2" : "3");
    opponentStatus.className = "status-tag";

    updateTurnHighlight();
    renderBoard();
    updateEvaluation();

    // Trigger AI move if player chooses Black
    if (myColor === "black") {
      makeAIMove();
    }
  } else {
    // Online Multiplayer Setup
    const timeLimitParam = params.get("timeLimit");
    socket.emit("join-game-room", { 
      roomId, 
      color: myColor, 
      timeLimit: timeLimitParam ? parseInt(timeLimitParam) : null
    });
    renderBoard();
  }
};
document.head.appendChild(script);

// Render chessboard
function renderBoard() {
  if (!chess) return;
  boardEl.innerHTML = "";
  const board = chess.board();

  // Find King square if in check
  let kingSquare = null;
  if (chess.in_check()) {
    const turn = chess.turn();
    board.forEach((row, rIdx) => {
      row.forEach((sq, cIdx) => {
        if (sq && sq.type === 'k' && sq.color === turn) {
          const files = ["a","b","c","d","e","f","g","h"];
          kingSquare = files[cIdx] + (8 - rIdx);
        }
      });
    });
  }

  // Reverse view for Black
  const isBlackPlayer = myColor === "black";
  const rows = isBlackPlayer ? [...board].reverse() : board;
  const colsIdx = isBlackPlayer ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  const files = ["a","b","c","d","e","f","g","h"];

  rows.forEach((row, rIdx) => {
    colsIdx.forEach((cColIdx) => {
      const piece = row[cColIdx];
      const actualFile = cColIdx;
      const rankNum = isBlackPlayer ? rIdx + 1 : 8 - rIdx;
      const fileChar = files[actualFile];
      const squareName = fileChar + rankNum;

      const sq = document.createElement("div");
      const isLight = (actualFile + (8 - rankNum)) % 2 === 0;
      sq.classList.add("square", isLight ? "light" : "dark");
      sq.dataset.square = squareName;

      // Coordinate labels
      if (actualFile === (isBlackPlayer ? 7 : 0)) {
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

      // Highlights
      if (lastMove && (squareName === lastMove.from || squareName === lastMove.to)) {
        sq.classList.add("last-move");
      }
      if (selectedSquare === squareName) {
        sq.classList.add("selected");
      }
      if (validMoves.includes(squareName)) {
        const hasEnemy = chess.get(squareName) && chess.get(squareName).color !== chess.turn();
        sq.classList.add(hasEnemy ? "valid-capture" : "valid-move");
      }
      if (chess.in_check() && squareName === kingSquare) {
        sq.classList.add("in-check");
      }

      // Piece rendering
      if (piece) {
        sq.innerHTML += getPieceSvgMarkup(piece.type, piece.color);
      }

      sq.addEventListener("click", () => handleSquareClick(squareName));
      boardEl.appendChild(sq);
    });
  });

  updateCapturedPieces();
}

// Handle Square Click
function handleSquareClick(squareName) {
  if (!gameActive || inHistoryReview || myColor === "spectator") return;

  // Clear any existing hints
  document.querySelectorAll(".square").forEach(sq => {
    sq.classList.remove("hint-from", "hint-to");
  });

  const currentTurn = chess.turn();
  const isMyTurn = (currentTurn === "w" && myColor === "white") ||
                   (currentTurn === "b" && myColor === "black");

  if (!isMyTurn) return;

  const piece = chess.get(squareName);

  if (piece && piece.color === currentTurn) {
    selectedSquare = squareName;
    const moves = chess.moves({ square: squareName, verbose: true });
    validMoves = moves.map(m => m.to);
    renderBoard();
    return;
  }

  if (selectedSquare && validMoves.includes(squareName)) {
    // Check if move is pawn promotion
    const activePiece = chess.get(selectedSquare);
    if (activePiece && activePiece.type === 'p') {
      const rank = squareName[1];
      if ((activePiece.color === 'w' && rank === '8') || (activePiece.color === 'b' && rank === '1')) {
        // Trigger Pawn Promotion Selection Flow
        promotionPending = { from: selectedSquare, to: squareName };
        promotionOverlay.style.display = "flex";
        return;
      }
    }

    makeMove(selectedSquare, squareName);
    return;
  }

  // Deselect
  selectedSquare = null;
  validMoves = [];
  renderBoard();
}

// Perform Pawn Promotion Choice
document.querySelectorAll(".promotion-choices .promo-choice-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!promotionPending) return;
    
    const choice = btn.dataset.piece;
    promotionOverlay.style.display = "none";
    
    makeMove(promotionPending.from, promotionPending.to, choice);
    promotionPending = null;
  });
});

// Make Move
function makeMove(from, to, promotion = undefined) {
  const isCapture = chess.get(to) !== null;
  const move = chess.move({ from, to, promotion });
  if (!move) return;

  // Sound trigger
  playSound(isCapture ? 'capture' : 'move');

  lastMove = { from, to };
  selectedSquare = null;
  validMoves = [];

  // Update history arrays
  moveHistory.push(move.san);
  fenHistory.push({ fen: chess.fen(), lastMove: { from, to } });
  
  updateMoveHistory();
  updateTurnHighlight();
  updateEvaluation();

  if (isAIMode) {
    renderBoard();
    if (!checkLocalGameEnd()) {
      makeAIMove();
    }
  } else {
    socket.emit("move-made", {
      roomId,
      move: { from, to, promotion },
      fen: chess.fen()
    });
    renderBoard();
    checkGameEndState();
  }
}

// History Timeline Navigation Review
function inspectHistoricalMove(moveIndex) {
  if (promotionPending) return;

  inHistoryReview = true;
  boardEl.classList.add("board-disabled");
  timelineBanner.style.display = "flex";

  // Highlight selected ledger item
  document.querySelectorAll(".move-row").forEach((row, rIdx) => {
    if (rIdx === Math.floor(moveIndex / 2)) {
      row.classList.add("selected-move");
    } else {
      row.classList.remove("selected-move");
    }
  });

  const state = fenHistory[moveIndex + 1];
  if (state) {
    chess.load(state.fen);
    lastMove = state.lastMove;
    renderBoard();
    updateEvaluation();
  }
}

timelineLiveBtn.addEventListener("click", () => {
  exitHistoryReview();
});

function exitHistoryReview() {
  inHistoryReview = false;
  
  // Re-enable clicks only if player is white or black (not spectator)
  if (myColor !== "spectator") {
    boardEl.classList.remove("board-disabled");
  }
  
  timelineBanner.style.display = "none";
  document.querySelectorAll(".move-row").forEach(row => row.classList.remove("selected-move"));

  // Load latest state
  const latestState = fenHistory[fenHistory.length - 1];
  chess.load(latestState.fen);
  lastMove = latestState.lastMove;
  renderBoard();
  updateEvaluation();
}

// Render Move History List
function updateMoveHistory() {
  movesListEl.innerHTML = "";
  for (let i = 0; i < moveHistory.length; i += 2) {
    const row = document.createElement("div");
    row.classList.add("move-row");
    
    const wIndex = i;
    const bIndex = i + 1;

    row.innerHTML = `
      <span class="move-num">${Math.floor(i/2)+1}.</span>
      <span class="move-white" data-index="${wIndex}">${moveHistory[i] || ""}</span>
      <span class="move-black" data-index="${bIndex}">${moveHistory[i+1] || ""}</span>
    `;

    // Bind Timeline Inspector clicks
    row.querySelector(".move-white").addEventListener("click", () => inspectHistoricalMove(wIndex));
    const bEl = row.querySelector(".move-black");
    if (moveHistory[bIndex]) {
      bEl.addEventListener("click", () => inspectHistoricalMove(bIndex));
    }

    movesListEl.appendChild(row);
  }
  movesListEl.scrollTop = movesListEl.scrollHeight;
}

// Format milliseconds to MM:SS
function formatTime(ms) {
  if (ms === null || ms === undefined || ms < 0) return "--:--";
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Update clock display
function updateClockDisplay(side, ms) {
  const displayVal = formatTime(ms);
  const isWhiteSide = side === "white";
  
  // If spectator, we check layout: top card (Black) is opponent, bottom card (White) is you.
  // Actually, let's keep clock updates matching player cards cleanly.
  let isMyClock = false;
  if (myColor === "spectator") {
    isMyClock = isWhiteSide; // Spectator views White on bottom card
  } else {
    isMyClock = (isWhiteSide && myColor === "white") || (!isWhiteSide && myColor === "black");
  }

  const targetEl = isMyClock ? yourClock : opponentClock;
  const targetPanel = isMyClock ? yourPanel : opponentPanel;

  if (targetEl) targetEl.textContent = displayVal;

  if (targetPanel) {
    if (ms > 0 && ms < 30000) {
      targetPanel.classList.add("low-time");
    } else {
      targetPanel.classList.remove("low-time");
    }
  }
}

// Start Client Side Dynamic Ticker
function startClockTicker() {
  if (clockInterval) clearInterval(clockInterval);
  if (!timeLimit) return;

  clockInterval = setInterval(() => {
    if (!gameActive) return;

    if (isAIMode) {
      // Local AI clocks ticker
      if (chess.turn() === "w") {
        timerW = Math.max(0, timerW - 100);
        updateClockDisplay("white", timerW);
        if (timerW <= 0) handleLocalGameOver("Defeat by Timeout", "Your clock ran out of time.", false);
      } else {
        timerB = Math.max(0, timerB - 100);
        updateClockDisplay("black", timerB);
        if (timerB <= 0) handleLocalGameOver("Victory by Timeout", "AI clock ran out of time.", true);
      }
    } else {
      // Multiplayer clocks ticker
      const activeColor = chess.turn();
      if (activeColor === "w") {
        timerW = Math.max(0, timerW - 100);
        updateClockDisplay("white", timerW);
      } else {
        timerB = Math.max(0, timerB - 100);
        updateClockDisplay("black", timerB);
      }
    }
  }, 100);
}

// Update Active Turn Highlighting
function updateTurnHighlight() {
  if (!gameActive) {
    yourPanel.classList.remove("active-turn");
    opponentPanel.classList.remove("active-turn");
    turnCardEl.classList.remove("active");
    if (turnIndicator) {
      turnIndicator.textContent = "Game not active";
    }
    return;
  }

  const turn = chess.turn();
  
  let isMyTurn = false;
  if (myColor !== "spectator") {
    isMyTurn = (turn === "w" && myColor === "white") || 
               (turn === "b" && myColor === "black");
  }

  if (myColor === "spectator") {
    const whiteActive = turn === "w";
    yourPanel.className = "player-panel you panel-spectator" + (whiteActive ? " active-turn" : "");
    opponentPanel.className = "player-panel opponent panel-spectator" + (!whiteActive ? " active-turn" : "");
    turnIndicator.textContent = `${turn === 'w' ? 'White' : 'Black'}'s Turn`;
    turnCardEl.classList.remove("active");
  } else if (isMyTurn) {
    yourPanel.classList.add("active-turn");
    opponentPanel.classList.remove("active-turn");
    turnIndicator.textContent = "Your Turn";
    turnCardEl.classList.add("active");
  } else {
    opponentPanel.classList.add("active-turn");
    yourPanel.classList.remove("active-turn");
    turnIndicator.textContent = isAIMode ? "AI is calculating..." : `${turn === 'w' ? 'White' : 'Black'}'s Turn`;
    turnCardEl.classList.remove("active");
  }
}

// Calculate and Render Captured Pieces and Material Difference
const materialValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const pieceAvatars = { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕" };

function updateCapturedPieces() {
  if (!chess) return;

  const initial = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1 }
  };

  const current = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
  };

  // Scan board
  chess.board().forEach(row => {
    row.forEach(sq => {
      if (sq && sq.type !== 'k') {
        current[sq.color][sq.type] += 1;
      }
    });
  });

  // Calculate captured (Initial minus Current)
  const captured = {
    w: [], // White pieces captured (held by Black)
    b: []  // Black pieces captured (held by White)
  };

  let whiteLossValue = 0;
  let blackLossValue = 0;

  ['p', 'n', 'b', 'r', 'q'].forEach(type => {
    const wCap = Math.max(0, initial.w[type] - current.w[type]);
    for (let i = 0; i < wCap; i++) {
      captured.w.push(type);
      whiteLossValue += materialValues[type];
    }

    const bCap = Math.max(0, initial.b[type] - current.b[type]);
    for (let i = 0; i < bCap; i++) {
      captured.b.push(type);
      blackLossValue += materialValues[type];
    }
  });

  // Render captured lists
  const isWhitePlayer = myColor === "white" || myColor === "spectator";
  const yourCapEl = isWhitePlayer ? yourCapturedEl : opponentCapturedEl;
  const oppCapEl = isWhitePlayer ? opponentCapturedEl : yourCapturedEl;

  if (yourCapEl) {
    yourCapEl.innerHTML = (isWhitePlayer ? captured.b : captured.w)
      .map(type => `<span class="captured-avatar">${pieceAvatars[type]}</span>`).join("");
  }

  if (oppCapEl) {
    oppCapEl.innerHTML = (isWhitePlayer ? captured.w : captured.b)
      .map(type => `<span class="captured-avatar" style="opacity: 0.6;">${pieceAvatars[type]}</span>`).join("");
  }

  // Material balance display
  if (materialBalanceEl) {
    const whiteAdvantage = blackLossValue - whiteLossValue;
    if (whiteAdvantage === 0) {
      materialBalanceEl.textContent = "";
    } else {
      const isAdvantageForWhite = whiteAdvantage > 0;
      const showAdvantage = (isAdvantageForWhite && isWhitePlayer) || (!isAdvantageForWhite && !isWhitePlayer);
      const sign = showAdvantage ? "+" : "-";
      materialBalanceEl.textContent = `Material ${sign}${Math.abs(whiteAdvantage)}`;
    }
  }
}

// Real-time Evaluation updates
function updateEvaluation() {
  if (!chess) return;

  const score = evaluateBoard(chess.board());
  // Divide score by 10 to represent values in standard pawns (1 pawn = 1.0)
  const scoreInPawns = score / 10;
  
  // Format bar filling height percentage (score of 0 is 50%)
  // A score of +10 (White up 10 pawns) is 95% full
  // A score of -10 (Black up 10 pawns) is 5% full
  let heightPercent = 50 + (scoreInPawns / 20) * 45;
  heightPercent = Math.min(Math.max(heightPercent, 5), 95);

  // If player views as Black, the board is flipped, so we flip the eval bar fill direction in CSS
  const evalBarContainer = document.getElementById("evalBarContainer");
  if (evalBarContainer) {
    if (myColor === "black") {
      evalBarContainer.style.flexDirection = "column";
    } else {
      evalBarContainer.style.flexDirection = "column-reverse";
    }
  }

  if (evalBarFill) {
    evalBarFill.style.height = `${heightPercent}%`;
  }

  if (evalBarText) {
    let scoreDisplay = "";
    if (scoreInPawns === 0) {
      scoreDisplay = "0.0";
    } else if (scoreInPawns > 0) {
      scoreDisplay = `+${scoreInPawns.toFixed(1)}`;
    } else {
      scoreDisplay = scoreInPawns.toFixed(1);
    }
    evalBarText.textContent = scoreDisplay;

    // Reposition text overlay vertically
    evalBarText.style.bottom = `${heightPercent}%`;

    // Swap text color theme for readability against dark/light background segments
    if (heightPercent < 50) {
      evalBarText.classList.add("black-winning");
    } else {
      evalBarText.classList.remove("black-winning");
    }
  }
}

// Audio Sound customizer binders
volumeSlider.addEventListener("input", (e) => {
  audioVolume = parseFloat(e.target.value);
  isMuted = audioVolume === 0;
  volumeMuteBtn.textContent = isMuted ? "🔇" : "🔊";
});

volumeMuteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  volumeMuteBtn.textContent = isMuted ? "🔇" : "🔊";
  if (!isMuted && audioVolume === 0) {
    audioVolume = 0.5;
    volumeSlider.value = 0.5;
  }
});

if (soundPackSelect) {
  soundPackSelect.addEventListener("change", (e) => {
    selectedSoundPack = e.target.value;
  });
}

// Client Side Game End Check (Multiplayer)
function checkGameEndState() {
  if (myColor === "spectator") return; // Spectators don't claim wins/losses
  
  if (chess.in_checkmate()) {
    const loser = chess.turn() === "w" ? "white" : "black";
    const winner = loser === "white" ? "black" : "white";
    socket.emit("game-ended", { roomId, reason: "checkmate", winner });
  } else if (chess.in_draw()) {
    socket.emit("game-ended", { roomId, reason: "draw", winner: null });
  } else if (chess.in_check()) {
    playSound('check');
    gameStatusEl.textContent = "Check!";
    gameStatusEl.classList.add("active");
  } else {
    gameStatusEl.textContent = "Game in Progress";
    gameStatusEl.classList.add("active");
  }
}

// Client Side Game End Check (AI Skirmish Mode)
function checkLocalGameEnd() {
  if (chess.in_checkmate()) {
    const loser = chess.turn() === "w" ? "white" : "black";
    const winner = loser === "white" ? "black" : "white";
    const userWins = winner === myColor;
    handleLocalGameOver(
      userWins ? "Victory!" : "Defeat", 
      userWins ? "You won by checkmate!" : "AI won by checkmate.", 
      userWins
    );
    return true;
  } else if (chess.in_draw()) {
    handleLocalGameOver("Draw", "The practice skirmish ended in a draw.", null);
    return true;
  } else if (chess.in_check()) {
    playSound('check');
    gameStatusEl.textContent = "Check!";
    gameStatusEl.classList.add("active");
  } else {
    gameStatusEl.textContent = "Practice Skirmish";
    gameStatusEl.classList.add("active");
  }
  return false;
}

// Local AI game over handler
function handleLocalGameOver(title, message, isWinner) {
  gameActive = false;
  if (clockInterval) clearInterval(clockInterval);
  updateTurnHighlight();
  
  playSound('game-over');

  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");

  const titleClass = isWinner === true ? "modal-title-win" : "";

  overlay.innerHTML = `
    <div class="modal">
      <h2 class="${titleClass}">${title}</h2>
      <p>${message}</p>
      <div class="modal-buttons">
        <button class="modal-btn-primary" id="localRematchBtn">Replay Match</button>
        <button class="modal-btn-secondary" onclick="window.location.href='/'">Lobby Dashboard</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Bind local AI rematch button
  overlay.querySelector("#localRematchBtn").addEventListener("click", () => {
    document.body.removeChild(overlay);
    resetLocalAIGame();
  });

  updateLocalStats(isWinner);
}

function resetLocalAIGame() {
  chess = new Chess();
  gameActive = true;
  moveHistory = [];
  fenHistory = [{ fen: chess.fen(), lastMove: null }];
  lastMove = null;
  selectedSquare = null;
  validMoves = [];
  
  // Swap colors for next practice match
  myColor = myColor === "white" ? "black" : "white";
  initPlayerCards();

  timerW = timeLimit * 60 * 1000;
  timerB = timeLimit * 60 * 1000;
  updateClockDisplay("white", timerW);
  updateClockDisplay("black", timerB);

  updateMoveHistory();
  updateTurnHighlight();
  renderBoard();
  updateEvaluation();

  startClockTicker();
  if (myColor === "black") {
    makeAIMove();
  }
}

// Client End Display Modal (Multiplayer)
function showGameOver(title, message, winner) {
  gameActive = false;
  if (clockInterval) clearInterval(clockInterval);
  if (reconnectInterval) clearInterval(reconnectInterval);
  reconnectBanner.style.display = "none";

  updateTurnHighlight();
  drawBtn.disabled = true;
  resignBtn.disabled = true;

  let isWinner = null;
  if (winner) {
    isWinner = winner === myColor;
  }

  // Play Game Over Sound
  playSound('game-over');

  // Draw Modal
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");

  let winTagClass = isWinner === true ? "modal-title-win" : "";
  const isSpectator = myColor === "spectator";

  overlay.innerHTML = `
    <div class="modal" id="gameResultModal">
      <h2 class="${winTagClass}">${title}</h2>
      <p>${message}</p>
      <div class="modal-buttons">
        ${isSpectator ? '' : '<button class="modal-btn-primary" id="rematchBtn">Request Rematch</button>'}
        <button class="modal-btn-secondary" onclick="window.location.href='/'">Lobby Dashboard</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  if (!isSpectator) {
    overlay.querySelector("#rematchBtn").addEventListener("click", (e) => {
      socket.emit("rematch-offer", { roomId });
      e.target.textContent = "Rematch Offered...";
      e.target.disabled = true;
    });
    updateLocalStats(isWinner);
  }
}

function updateLocalStats(isWinner) {
  if (isWinner === null || myColor === "spectator") return;
  const stats = JSON.parse(localStorage.getItem("kingside_stats")) || { wins: 0, losses: 0, draws: 0 };
  if (isWinner === true) {
    stats.wins += 1;
  } else if (isWinner === false) {
    stats.losses += 1;
  } else {
    stats.draws += 1;
  }
  localStorage.setItem("kingside_stats", JSON.stringify(stats));
}

// Chat system
const chatLogEl = document.getElementById("chatLog");
const chatInputEl = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

function addSystemChatMessage(text) {
  const msgEl = document.createElement("div");
  msgEl.classList.add("chat-system");
  msgEl.textContent = text;
  chatLogEl.appendChild(msgEl);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function addChatMessage(senderColor, text) {
  const msgEl = document.createElement("div");
  msgEl.classList.add("chat-msg");

  const isSelf = senderColor === myColor;
  if (isSelf) {
    msgEl.classList.add("self");
  } else if (senderColor === "spectator") {
    msgEl.classList.add("chat-system");
  } else {
    msgEl.classList.add(senderColor === "white" ? "white-sender" : "black-sender");
  }

  msgEl.innerHTML = `
    <span class="chat-sender">${senderColor === "spectator" ? 'Observer' : isSelf ? 'You' : senderColor}</span>
    <span class="chat-text">${escapeHtml(text)}</span>
  `;
  chatLogEl.appendChild(msgEl);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sendChatMessage() {
  const text = chatInputEl.value.trim();
  if (!text) return;
  if (isAIMode) {
    addChatMessage(myColor, text);
    chatInputEl.value = "";
    setTimeout(() => {
      addChatMessage(myColor === "white" ? "black" : "white", "I am a local AI engine. Let's focus on the board skirmish!");
    }, 800);
    return;
  }
  socket.emit("chat-message", { roomId, message: text });
  chatInputEl.value = "";
}

sendChatBtn.addEventListener("click", sendChatMessage);
chatInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

// Aesthetics Theme Picker
document.querySelectorAll(".theme-picker-row .theme-dot").forEach(dot => {
  dot.addEventListener("click", () => {
    document.querySelectorAll(".theme-picker-row .theme-dot").forEach(d => d.classList.remove("active"));
    dot.classList.add("active");
    
    const theme = dot.dataset.theme;
    document.body.className = `theme-${theme}`;
  });
});

// Piece Set Picker
const pieceSetSelect = document.getElementById("pieceSetSelect");
if (pieceSetSelect) {
  pieceSetSelect.addEventListener("change", (e) => {
    currentPieceSet = e.target.value;
    renderBoard();
  });
}

// ────────────────────────────────────────────────────────
// MINIMAX CHESS AI ENGINE (Local Skirmishes Lvl 1-3)
// ────────────────────────────────────────────────────────

function makeAIMove() {
  if (!gameActive || !isAIMode) return;

  const activeColor = chess.turn();
  const isComputerTurn = (activeColor === "w" && myColor === "black") ||
                         (activeColor === "b" && myColor === "white");

  if (!isComputerTurn) return;

  turnIndicator.textContent = "AI is calculating...";

  setTimeout(() => {
    const aiColor = myColor === "white" ? "b" : "w";
    const bestMove = getBestMove(chess, aiDifficulty, aiColor);

    if (bestMove) {
      const from = bestMove.from;
      const to = bestMove.to;
      const promotion = bestMove.promotion;

      const isCapture = chess.get(to) !== null;
      chess.move(bestMove);

      playSound(isCapture ? 'capture' : 'move');
      lastMove = { from, to };

      // Update history caches
      moveHistory.push(bestMove.san);
      fenHistory.push({ fen: chess.fen(), lastMove: { from, to } });

      updateMoveHistory();
      updateTurnHighlight();
      renderBoard();
      updateEvaluation();
      checkLocalGameEnd();
    }
  }, 500); // 500ms thinking delay
}

function getBestMove(game, difficulty, aiColor) {
  const possibleMoves = game.moves({ verbose: true });
  if (possibleMoves.length === 0) return null;

  if (difficulty === "easy") {
    // Level 1: Select random move
    return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  }

  // Level 2 (depth 2) or Level 3 (depth 3 minimax)
  const depth = difficulty === "medium" ? 2 : 3;
  let bestMove = null;
  let bestValue = aiColor === "w" ? -Infinity : Infinity;

  // Shuffle array to make AI play differently across sessions
  possibleMoves.sort(() => 0.5 - Math.random());

  for (let i = 0; i < possibleMoves.length; i++) {
    const move = possibleMoves[i];
    game.move(move);
    const boardValue = minimax(game, depth - 1, -Infinity, Infinity, aiColor === "b", aiColor);
    game.undo();

    if (aiColor === "w") {
      if (boardValue > bestValue) {
        bestValue = boardValue;
        bestMove = move;
      }
    } else {
      if (boardValue < bestValue) {
        bestValue = boardValue;
        bestMove = move;
      }
    }
  }
  return bestMove;
}

// Positional Heuristics Table for AI Engine
const pawnEval = [
  [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
  [5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0],
  [1.0,  1.0,  2.0,  3.0,  3.0,  2.0,  1.0,  1.0],
  [0.5,  0.5,  1.0,  2.5,  2.5,  1.0,  0.5,  0.5],
  [0.0,  0.0,  0.0,  2.0,  2.0,  0.0,  0.0,  0.0],
  [0.5, -0.5, -1.0,  0.0,  0.0, -1.0, -0.5,  0.5],
  [0.5,  1.0,  1.0, -2.0, -2.0,  1.0,  1.0,  0.5],
  [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
];

const knightEval = [
  [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0],
  [-4.0, -2.0,  0.0,  0.0,  0.0,  0.0, -2.0, -4.0],
  [-3.0,  0.0,  1.0,  1.5,  1.5,  1.0,  0.0, -3.0],
  [-3.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -3.0],
  [-3.0,  0.0,  1.5,  2.0,  2.0,  1.5,  0.0, -3.0],
  [-3.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -3.0],
  [-4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0],
  [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0]
];

const bishopEval = [
  [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0],
  [-1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
  [-1.0,  0.0,  0.5,  1.0,  1.0,  0.5,  0.0, -1.0],
  [-1.0,  0.5,  0.5,  1.0,  1.0,  0.5,  0.5, -1.0],
  [-1.0,  0.0,  1.0,  1.0,  1.0,  1.0,  0.0, -1.0],
  [-1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0],
  [-1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
  [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0]
];

const rookEval = [
  [0.0,  0.0,  0.0,  0.5,  0.5,  0.0,  0.0,  0.0],
  [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
  [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
  [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
  [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
  [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
  [5.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0,  5.0],
  [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
];

const queenEval = [
  [-2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0],
  [-1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
  [-1.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
  [-0.5,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
  [0.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
  [-1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
  [-1.0,  0.0,  0.5,  0.0,  0.0,  0.5,  0.0, -1.0],
  [-2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0]
];

const kingEvalWhite = [
  [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
  [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
  [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
  [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
  [-2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
  [-1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
  [2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0],
  [2.0,  3.0,  1.0,  0.0,  0.0,  1.0,  3.0,  2.0]
];

const kingEvalBlack = [...kingEvalWhite].reverse();

function minimax(game, depth, alpha, beta, isMaximizing, aiColor) {
  if (depth === 0) {
    return evaluateBoard(game.board());
  }

  const possibleMoves = game.moves();
  if (possibleMoves.length === 0) {
    if (game.in_checkmate()) {
      return game.turn() === aiColor ? -99999 : 99999;
    }
    return 0; // stalemate/draw
  }

  if (isMaximizing) {
    let maxValue = -Infinity;
    for (let i = 0; i < possibleMoves.length; i++) {
      game.move(possibleMoves[i]);
      const value = minimax(game, depth - 1, alpha, beta, false, aiColor);
      game.undo();
      maxValue = Math.max(maxValue, value);
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break; // alpha pruning
    }
    return maxValue;
  } else {
    let minValue = Infinity;
    for (let i = 0; i < possibleMoves.length; i++) {
      game.move(possibleMoves[i]);
      const value = minimax(game, depth - 1, alpha, beta, true, aiColor);
      game.undo();
      minValue = Math.min(minValue, value);
      beta = Math.min(beta, value);
      if (beta <= alpha) break; // beta pruning
    }
    return minValue;
  }
}

function evaluateBoard(board) {
  let totalEvaluation = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      totalEvaluation += getPieceValue(board[r][c], r, c);
    }
  }
  return totalEvaluation;
}

function getPieceValue(piece, r, c) {
  if (piece === null) return 0;
  
  let val = 0;
  if (piece.type === 'p') {
    val = 10 + pawnEval[r][c];
  } else if (piece.type === 'r') {
    val = 50 + rookEval[r][c];
  } else if (piece.type === 'n') {
    val = 30 + knightEval[r][c];
  } else if (piece.type === 'b') {
    val = 30 + bishopEval[r][c];
  } else if (piece.type === 'q') {
    val = 90 + queenEval[r][c];
  } else if (piece.type === 'k') {
    val = 900 + (piece.color === 'w' ? kingEvalWhite[r][c] : kingEvalBlack[r][c]);
  }
  
  return piece.color === 'w' ? val : -val;
}

// Socket Event Handlers
socket.on("connect", () => {
  document.getElementById("connDot").className = "dot connected";
  document.getElementById("connText").textContent = "Connected";
  reconnectBanner.style.display = "none";
  if (reconnectInterval) clearInterval(reconnectInterval);
});

socket.on("disconnect", () => {
  document.getElementById("connDot").className = "dot";
  document.getElementById("connText").textContent = "Disconnected";
});

socket.on("waiting-for-opponent", () => {
  gameStatusEl.textContent = "Waiting for Opponent...";
  opponentStatus.textContent = "Offline";
  opponentStatus.className = "status-tag disconnected";
  if (turnIndicator) {
    turnIndicator.textContent = "Waiting for opponent...";
  }
});

socket.on("color-assigned", ({ color }) => {
  myColor = color;
  initPlayerCards();
  renderBoard();
  updateEvaluation();
});

socket.on("game-start", (state) => {
  gameActive = true;
  
  const isSpectator = myColor === "spectator";
  if (!isSpectator) {
    drawBtn.disabled = false;
    resignBtn.disabled = false;
  }

  gameStatusEl.textContent = "Game In Progress";
  gameStatusEl.className = "game-status-bubble active";
  
  opponentStatus.textContent = "Online";
  opponentStatus.className = "status-tag";

  if (state && state.timerW) {
    timeLimit = state.timeLimit;
    timerW = state.timerW;
    timerB = state.timerB;
    updateClockDisplay("white", timerW);
    updateClockDisplay("black", timerB);
    startClockTicker();
  }

  updateTurnHighlight();
  renderBoard();
  updateEvaluation();
});

socket.on("move-update", ({ move, fen, timerW: syncedW, timerB: syncedB, currentTurn }) => {
  chess.load(fen);
  lastMove = { from: move.from, to: move.to };
  
  // Update timeline history caches
  moveHistory.push(chess.history().pop() || move.to);
  fenHistory.push({ fen: fen, lastMove: { from: move.from, to: move.to } });
  
  updateMoveHistory();

  // Play appropriate sound
  if (chess.in_check()) {
    playSound('check');
  } else {
    playSound(move.san && move.san.includes("x") ? 'capture' : 'move');
  }

  if (syncedW !== undefined) {
    timerW = syncedW;
    timerB = syncedB;
    updateClockDisplay("white", timerW);
    updateClockDisplay("black", timerB);
  }

  updateTurnHighlight();
  renderBoard();
  updateEvaluation();
  checkGameEndState();
});

socket.on("time-sync", ({ timerW: syncedW, timerB: syncedB }) => {
  timerW = syncedW;
  timerB = syncedB;
  updateClockDisplay("white", timerW);
  updateClockDisplay("black", timerB);
});

socket.on("chat-message-received", (msg) => {
  addChatMessage(msg.senderColor, msg.text);
});

socket.on("draw-offered", ({ color }) => {
  if (myColor === "spectator") return;
  if (color !== myColor) {
    showCustomConfirm(
      "Draw Offered",
      `Opponent (${color}) has offered a draw agreement. Accept?`,
      () => socket.emit("draw-response", { roomId, accepted: true }),
      () => socket.emit("draw-response", { roomId, accepted: false })
    );
  }
});

socket.on("draw-declined", () => {
  if (myColor === "spectator") return;
  addSystemChatMessage("Draw offer declined.");
});

socket.on("player-disconnected-countdown", ({ color, seconds }) => {
  opponentStatus.textContent = "Disconnected";
  opponentStatus.className = "status-tag disconnected";

  reconnectTimeLeft = seconds;
  reconnectBanner.style.display = "block";
  reconnectText.textContent = `Opponent (${color}) disconnected! Waiting ${reconnectTimeLeft}s for them to rejoin...`;

  if (reconnectInterval) clearInterval(reconnectInterval);
  reconnectInterval = setInterval(() => {
    reconnectTimeLeft -= 1;
    if (reconnectTimeLeft <= 0) {
      clearInterval(reconnectInterval);
      reconnectBanner.style.display = "none";
    } else {
      reconnectText.textContent = `Opponent (${color}) disconnected! Waiting ${reconnectTimeLeft}s for them to rejoin...`;
    }
  }, 1000);
});

socket.on("player-reconnected", ({ color }) => {
  opponentStatus.textContent = "Online";
  opponentStatus.className = "status-tag";
  reconnectBanner.style.display = "none";
  if (reconnectInterval) clearInterval(reconnectInterval);
  addSystemChatMessage(`System: Opponent (${color}) reconnected.`);
});

socket.on("reconnected-state", (state) => {
  myColor = state.color || myColor;
  initPlayerCards();
  
  if (state.fen) {
    chess.load(state.fen);
  }
  
  timeLimit = state.timeLimit;
  timerW = state.timerW;
  timerB = state.timerB;
  gameActive = state.gameStarted && !state.gameOver;
  
  const isSpectator = myColor === "spectator";

  if (gameActive) {
    if (!isSpectator) {
      drawBtn.disabled = false;
      resignBtn.disabled = false;
    }
    gameStatusEl.textContent = "Game In Progress";
    gameStatusEl.className = "game-status-bubble active";
    opponentStatus.textContent = "Online";
    opponentStatus.className = "status-tag";
  }

  if (isSpectator) {
    opponentStatus.textContent = "Spectating Match";
    opponentStatus.className = "status-tag spectator";
  }

  // Restore Move history list
  moveHistory = chess.history();
  updateMoveHistory();

  // Re-build timeline cache
  fenHistory = [{ fen: new Chess().fen(), lastMove: null }];
  const tempChess = new Chess();
  moveHistory.forEach(san => {
    const m = tempChess.move(san);
    if (m) {
      fenHistory.push({ fen: tempChess.fen(), lastMove: { from: m.from, to: m.to } });
    }
  });

  // Restore chat logs
  chatLogEl.innerHTML = "";
  if (state.chatHistory && state.chatHistory.length > 0) {
    state.chatHistory.forEach(msg => {
      addChatMessage(msg.senderColor, msg.text);
    });
  } else {
    addSystemChatMessage(isSpectator ? "Spectator node initialized." : "Reconnected successfully.");
  }

  updateClockDisplay("white", timerW);
  updateClockDisplay("black", timerB);
  if (gameActive && timeLimit) {
    startClockTicker();
  }

  updateTurnHighlight();
  renderBoard();
  updateEvaluation();
});

socket.on("rematch-offered", ({ color }) => {
  if (myColor === "spectator") return;
  if (color !== myColor) {
    showCustomConfirm(
      "Rematch Request",
      `Opponent (${color}) has offered a rematch! Swap sides and replay?`,
      () => socket.emit("rematch-response", { roomId, accepted: true }),
      () => socket.emit("rematch-response", { roomId, accepted: false })
    );
  }
});

socket.on("rematch-declined", () => {
  if (myColor === "spectator") return;
  addSystemChatMessage("Rematch request was declined.");
  const rematchBtn = document.getElementById("rematchBtn");
  if (rematchBtn) {
    rematchBtn.textContent = "Request Rematch";
    rematchBtn.disabled = false;
  }
});

socket.on("rematch-start", (state) => {
  // Clear any active overlays
  const modalOverlays = document.querySelectorAll(".modal-overlay");
  modalOverlays.forEach(overlay => document.body.removeChild(overlay));

  gameActive = true;
  
  const isSpectator = myColor === "spectator";
  if (!isSpectator) {
    drawBtn.disabled = false;
    resignBtn.disabled = false;
    myColor = state.color;
  }
  
  timeLimit = state.timeLimit;
  timerW = state.timerW;
  timerB = state.timerB;

  // Reset engine states
  chess = new Chess();
  moveHistory = [];
  fenHistory = [{ fen: chess.fen(), lastMove: null }];
  lastMove = null;
  selectedSquare = null;
  validMoves = [];

  initPlayerCards();
  updateMoveHistory();
  updateClockDisplay("white", timerW);
  updateClockDisplay("black", timerB);

  gameStatusEl.textContent = "Game In Progress";
  gameStatusEl.className = "game-status-bubble active";
  opponentStatus.textContent = "Online";
  opponentStatus.className = "status-tag";

  updateTurnHighlight();
  renderBoard();
  updateEvaluation();

  startClockTicker();
  addSystemChatMessage("System: A new rematch has started!");
});

socket.on("game-over", ({ reason, winner, loser }) => {
  gameActive = false;
  if (clockInterval) clearInterval(clockInterval);
  if (reconnectInterval) clearInterval(reconnectInterval);
  reconnectBanner.style.display = "none";

  drawBtn.disabled = true;
  resignBtn.disabled = true;

  let title = "Game Over";
  let desc = "";

  if (reason === "checkmate") {
    title = winner === myColor ? "Victory!" : winner === "spectator" ? "Game Over" : "Defeat";
    desc = `Game ended by checkmate. ${winner} wins.`;
  } else if (reason === "timeout") {
    title = winner === myColor ? "Victory!" : winner === "spectator" ? "Game Over" : "Defeat";
    desc = `Game ended by timeout. ${winner} wins.`;
  } else if (reason === "resign") {
    title = winner === myColor ? "Victory!" : winner === "spectator" ? "Game Over" : "Defeat";
    desc = `${loser} resigned. ${winner} wins.`;
  } else if (reason === "abandoned") {
    title = winner === myColor ? "Victory!" : "Defeat";
    desc = `Opponent abandoned the match. You win!`;
  } else if (reason === "draw-agreement") {
    title = "Draw";
    desc = "Game drawn by mutual agreement.";
  } else if (reason === "draw") {
    title = "Draw";
    desc = "Game ended in a draw (Stalemate/Insufficient Material/50-move rule).";
  }

  showGameOver(title, desc, winner);
});