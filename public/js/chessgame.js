const socket = io();
const chess = new Chess();
const boardelement = document.querySelector(".chessboard");

// Scoreboard elements
const whiteScoreElement = document.querySelector("#white-score");
const blackScoreElement = document.querySelector("#black-score");
const whiteCapturedElement = document.querySelector("#white-captured");
const blackCapturedElement = document.querySelector("#black-captured");
const whiteStatusElement = document.querySelector("#white-status");
const blackStatusElement = document.querySelector("#black-status");
const gameStatusElement = document.querySelector("#game-status");
const currentTurnElement = document.querySelector("#current-turn");
const moveCountElement = document.querySelector("#move-count");
const playerRoleElement = document.querySelector("#player-role");
const moveHistoryElement = document.querySelector("#move-history");
const totalCapturesElement = document.querySelector("#total-captures");
const checksGivenElement = document.querySelector("#checks-given");
const gameTimeElement = document.querySelector("#game-time");

// Audio system
class ChessAudio {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5;
        this.initializeSounds();
    }
    
    initializeSounds() {
        // Create audio contexts for different sounds
        this.sounds = {
            move: this.createSound([800, 600], 0.1, 'sine'),
            capture: this.createSound([400, 300, 200], 0.2, 'square'),
            check: this.createSound([1000, 800, 1200], 0.15, 'sawtooth'),
            invalidMove: this.createSound([200, 150], 0.3, 'square'),
            gameOver: this.createSound([600, 500, 400, 300], 0.4, 'sine'),
            castling: this.createSound([700, 800, 900], 0.15, 'triangle')
        };
    }
    
    createSound(frequencies, duration, waveType = 'sine') {
        return () => {
            if (!this.enabled) return;
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const gainNode = audioContext.createGain();
            
            gainNode.connect(audioContext.destination);
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume, audioContext.currentTime + 0.01);
            
            frequencies.forEach((freq, index) => {
                const oscillator = audioContext.createOscillator();
                oscillator.connect(gainNode);
                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                oscillator.type = waveType;
                
                const startTime = audioContext.currentTime + (index * duration / frequencies.length);
                const endTime = startTime + (duration / frequencies.length);
                
                oscillator.start(startTime);
                oscillator.stop(endTime);
            });
            
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        };
    }
    
    play(soundName) {
        if (this.sounds[soundName]) {
            try {
                this.sounds[soundName]();
            } catch (error) {
                console.log('Audio playback failed:', error);
            }
        }
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
}

// Initialize audio system
const audioSystem = new ChessAudio();

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let whiteScore = 0;
let blackScore = 0;
let whiteCaptured = [];
let blackCaptured = [];
let moveHistory = [];
let totalCaptures = 0;
let checksGiven = 0;
let gameStartTime = null;
let gameTimeInterval = null;

const pieceValues = {
    'p': 1,
    'r': 5,
    'n': 3,
    'b': 3,
    'q': 9,
    'k': 0
};

// Start game timer
const startGameTimer = () => {
    gameStartTime = Date.now();
    gameTimeInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        gameTimeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
};

// Stop game timer
const stopGameTimer = () => {
    if (gameTimeInterval) {
        clearInterval(gameTimeInterval);
        gameTimeInterval = null;
    }
};

// Update player status indicators
const updatePlayerStatus = () => {
    const currentTurn = chess.turn();
    
    if (currentTurn === 'w') {
        whiteStatusElement.classList.add('status-active');
        whiteStatusElement.classList.remove('status-inactive');
        blackStatusElement.classList.add('status-inactive');
        blackStatusElement.classList.remove('status-active');
        currentTurnElement.textContent = 'White';
    } else {
        blackStatusElement.classList.add('status-active');
        blackStatusElement.classList.remove('status-inactive');
        whiteStatusElement.classList.add('status-inactive');
        whiteStatusElement.classList.remove('status-active');
        currentTurnElement.textContent = 'Black';
    }
};

// Update move count
const updateMoveCount = () => {
    const history = chess.history();
    moveCountElement.textContent = Math.ceil(history.length / 2);
};

// Add move to history display
const addMoveToHistory = (move, moveNumber) => {
    if (moveHistory.length === 0) {
        moveHistoryElement.innerHTML = '';
    }
    
    const isWhiteMove = moveNumber % 2 === 1;
    const fullMoveNumber = Math.ceil(moveNumber / 2);
    
    let moveText = '';
    if (isWhiteMove) {
        moveText = `${fullMoveNumber}. ${move.san}`;
    } else {
        moveText = `${move.san}`;
    }
    
    if (isWhiteMove) {
        const moveElement = document.createElement('div');
        moveElement.className = 'flex text-sm mb-1';
        moveElement.innerHTML = `
            <span class="text-gray-300 w-8">${fullMoveNumber}.</span>
            <span class="text-white mr-4">${move.san}</span>
            <span id="black-move-${fullMoveNumber}" class="text-white"></span>
        `;
        moveHistoryElement.appendChild(moveElement);
    } else {
        const blackMoveElement = document.querySelector(`#black-move-${fullMoveNumber}`);
        if (blackMoveElement) {
            blackMoveElement.textContent = move.san;
        }
    }
    
    // Scroll to bottom
    moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
};

const renderBoard = () => {
    const board = chess.board();
    boardelement.innerHTML = "";
    
    // Flip board for black player
    const boardToRender = playerRole === 'b' ? board.slice().reverse() : board;
    
    boardToRender.forEach((row, rowindex) => {
        const rowToRender = playerRole === 'b' ? row.slice().reverse() : row;
        rowToRender.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square",
                (rowindex + squareindex) % 2 == 0 ? "light" : "dark"
            );
            
            // Calculate actual board position
            const actualRow = playerRole === 'b' ? 7 - rowindex : rowindex;
            const actualCol = playerRole === 'b' ? 7 - squareindex : squareindex;
            
            squareElement.dataset.row = actualRow;
            squareElement.dataset.col = actualCol;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                if (pieceElement.draggable) {
                    pieceElement.classList.add("draggable");
                }

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: actualRow, col: actualCol };
                        e.dataTransfer.setData("text/plain", "");
                        pieceElement.classList.add("dragging");
                    }
                });
                
                pieceElement.addEventListener("dragend", (e) => {
                    pieceElement.classList.remove("dragging");
                    draggedPiece = null;
                    sourceSquare = null;
                });
                
                squareElement.appendChild(pieceElement);
            }
            
            squareElement.addEventListener("dragover", function (e) {
                e.preventDefault();
            });
            
            squareElement.addEventListener("drop", function (e) {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSource = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col),
                    };
                    handleMove(sourceSquare, targetSource);
                }
            });
            
            boardelement.appendChild(squareElement);
        });
    });
    
    // Add board flip class for black player
    if (playerRole === 'b') {
        boardelement.classList.add('flipped');
    } else {
        boardelement.classList.remove('flipped');
    }
};

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: "q"
    };

    // Only emit move to server, don't process locally
    socket.emit("move", move);
};

const getPieceUnicode = (piece) => {
    switch (piece.type) {
        case 'p':
            return piece.color === 'w' ? '♙' : '♟';
        case 'r':
            return piece.color === 'w' ? '♖' : '♜';
        case 'n':
            return piece.color === 'w' ? '♘' : '♞';
        case 'b':
            return piece.color === 'w' ? '♗' : '♝';
        case 'q':
            return piece.color === 'w' ? '♕' : '♛';
        case 'k':
            return piece.color === 'w' ? '♔' : '♚';
        default:
            return '';
    }
};

const updateScore = (capturedPiece) => {
    const pieceValue = pieceValues[capturedPiece.type];
    const pieceSymbol = getPieceUnicode(capturedPiece);
    
    // Play capture sound
    audioSystem.play('capture');
    
    if (capturedPiece.color === 'w') {
        blackScore += pieceValue;
        blackCaptured.push(pieceSymbol);
        blackScoreElement.textContent = blackScore;
        blackScoreElement.classList.add('score-update');
        setTimeout(() => blackScoreElement.classList.remove('score-update'), 500);
    } else {
        whiteScore += pieceValue;
        whiteCaptured.push(pieceSymbol);
        whiteScoreElement.textContent = whiteScore;
        whiteScoreElement.classList.add('score-update');
        setTimeout(() => whiteScoreElement.classList.remove('score-update'), 500);
    }
    
    // Update captured pieces display
    whiteCapturedElement.innerHTML = whiteCaptured.map(piece => 
        `<span class="captured-piece">${piece}</span>`
    ).join('');
    
    blackCapturedElement.innerHTML = blackCaptured.map(piece => 
        `<span class="captured-piece">${piece}</span>`
    ).join('');
    
    totalCaptures++;
    totalCapturesElement.textContent = totalCaptures;
};

const checkGameState = () => {
    // Check for check
    if (chess.in_check()) {
        checksGiven++;
        checksGivenElement.textContent = checksGiven;
        // Play check sound
        audioSystem.play('check');
    }
    
    if (chess.in_checkmate()) {
        audioSystem.play('gameOver');
        return chess.turn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
    }
    if (chess.in_draw()) {
        audioSystem.play('gameOver');
        return 'The game is a draw!';
    }
    if (chess.in_stalemate()) {
        audioSystem.play('gameOver');
        return 'The game is a stalemate!';
    }
    if (chess.in_threefold_repetition()) {
        audioSystem.play('gameOver');
        return 'The game is a draw by threefold repetition!';
    }
    if (chess.insufficient_material()) {
        audioSystem.play('gameOver');
        return 'The game is a draw due to insufficient material!';
    }
    return null;
};

const showMessage = (message) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: white;
        padding: 20px 30px;
        border-radius: 15px;
        font-size: 18px;
        font-weight: 600;
        z-index: 1000;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        border: 2px solid #64748b;
    `;
    messageElement.innerText = message;
    document.body.appendChild(messageElement);
    
    // Remove message after 5 seconds
    setTimeout(() => {
        if (document.body.contains(messageElement)) {
            document.body.removeChild(messageElement);
        }
    }, 5000);
};

const updateGameStatus = (status) => {
    gameStatusElement.textContent = status;
};

// Socket event handlers
socket.on("playerRole", function (role) {
    playerRole = role;
    const roleText = role === 'w' ? 'White Player' : 'Black Player';
    playerRoleElement.textContent = roleText;
    updateGameStatus(`You are playing as ${roleText}`);
    renderBoard();
    console.log("Assigned role:", role);
});

socket.on("spectatorRole", function () {
    playerRole = null;
    playerRoleElement.textContent = 'Spectator';
    updateGameStatus('You are watching the game');
    renderBoard();
    console.log("Assigned as spectator");
});

socket.on("boardState", function (fen) {
    chess.load(fen);
    renderBoard();
    updatePlayerStatus();
    updateMoveCount();
});

socket.on("move", function (move) {
    // Get target piece before making move (for score calculation)
    const targetPiece = chess.get(move.to);
    
    // Make the move
    const moveResult = chess.move(move);
    
    if (moveResult) {
        // Start timer on first move
        if (!gameStartTime) {
            startGameTimer();
            updateGameStatus('Game in progress');
        }
        
        // Play appropriate sound based on move type
        if (targetPiece) {
            // Capture move - sound handled in updateScore
        } else if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
            // Castling move
            audioSystem.play('castling');
        } else {
            // Regular move
            audioSystem.play('move');
        }
        
        // Add to move history
        const history = chess.history({ verbose: true });
        addMoveToHistory(moveResult, history.length);
        
        renderBoard();
        updatePlayerStatus();
        updateMoveCount();

        // Update score if piece was captured
        if (targetPiece) {
            updateScore(targetPiece);
        }

        // Check game state
        const result = checkGameState();
        if (result) {
            stopGameTimer();
            updateGameStatus(result);
            showMessage(result);
        }
    }
});

socket.on("invalidMove", function (move) {
    console.log("Invalid move:", move);
    audioSystem.play('invalidMove');
    showMessage("Invalid move! Try again.");
});

socket.on("gameOver", function (result) {
    stopGameTimer();
    updateGameStatus(result);
    showMessage(result);
});

renderBoard();
updatePlayerStatus();

document.getElementById('sound-toggle').addEventListener('click', function() {
    const isEnabled = audioSystem.toggle();
    this.textContent = isEnabled ? 'ON' : 'OFF';
    this.className = isEnabled ? 
        'bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors' :
        'bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors';
});

document.getElementById('volume-slider').addEventListener('input', function() {
    audioSystem.setVolume(this.value / 100);
});

// Test sound on first user interaction
document.addEventListener('click', function() {
    // This helps with browser audio policy restrictions
    if (!audioSystem.hasPlayedOnce) {
        audioSystem.hasPlayedOnce = true;
    }
}, { once: true });