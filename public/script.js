// script.js

// --- DOM Elements ---
const chessboard = document.getElementById('chessboard');
const whiteCapturedPieces = document.getElementById('white-captured');
const blackCapturedPieces = document.getElementById('black-captured');
const whiteScoreElem = document.getElementById('white-score');
const blackScoreElem = document.getElementById('black-score');
const currentTurnElem = document.getElementById('current-turn');
const turnIndicator = document.getElementById('turn-indicator');
const gameStatusElem = document.getElementById('game-status');
const playerRoleElem = document.getElementById('player-role');
const roleBadge = document.getElementById('role-badge');
const spectatorCountElem = document.getElementById('spectator-count');
const moveCountElem = document.getElementById('move-count');
const gameTimeElem = document.getElementById('game-time');
const newGameBtn = document.getElementById('new-game-btn');
const soundToggleBtn = document.getElementById('sound-toggle');
const volumeSlider = document.getElementById('volume-slider');
const whitePlayerCard = document.getElementById('white-player-card');
const blackPlayerCard = document.getElementById('black-player-card');
const whiteStatusIndicator = document.getElementById('white-status');
const blackStatusIndicator = document.getElementById('black-status');
const moveHistoryElem = document.getElementById('move-history');
const totalCapturesElem = document.getElementById('total-captures');
const checksGivenElem = document.getElementById('checks-given');
const waitingOverlay = document.getElementById('waiting-overlay');
const waitingMessage = document.getElementById('waiting-message');
const celebrationModal = document.getElementById('celebration-modal');
// *** CORRECTION START ***
let celebrationMessage = document.getElementById('celebration-message'); // Changed from const to let
// *** CORRECTION END ***
const connectionStatusElem = document.getElementById('connection-status');
const rankCoordsElem = document.getElementById('rank-coords');
const fileCoordsElem = document.getElementById('file-coords');


// --- Game State Variables (Client-side) ---
let currentBoard = [];
let playerColor = null; // 'white', 'black', or null (for spectator)
let selectedPieceSquare = null; // HTMLDivElement representing the selected square
let validMoves = []; // Array of valid move objects from chess.js
let gameTurn = 'w'; // 'w' for white, 'b' for black
let isBoardFlipped = false;
let gameActive = false;
let gameStartTime = 0; // Stored in seconds
let gameInterval;
let totalCaptures = 0;
let checksGiven = 0;

// --- Sound Effects ---
let moveSound;
let captureSound;
let checkSound;
let gameOverSound;
let clickSound;
let soundEnabled = true;

try {
    moveSound = new Audio('/sounds/move.mp3');
    captureSound = new Audio('/sounds/capture.mp3');
    checkSound = new Audio('/sounds/check.mp3');
    gameOverSound = new Audio('/sounds/game-over.mp3');
    clickSound = new Audio('/sounds/click.mp3');

    // Set initial volume
    moveSound.volume = 0.5;
    captureSound.volume = 0.5;
    checkSound.volume = 0.5;
    gameOverSound.volume = 0.5;
    clickSound.volume = 0.5;
} catch (e) {
    console.error("Error loading audio files:", e);
    // Disable sound if there's an issue loading them
    soundEnabled = false;
    if (soundToggleBtn) {
        soundToggleBtn.textContent = 'OFF';
        soundToggleBtn.classList.remove('bg-green-600');
        soundToggleBtn.classList.add('bg-gray-600');
    }
    if (volumeSlider) {
        volumeSlider.disabled = true;
    }
}

/**
 * Plays a sound effect if sound is enabled.
 * Catches potential errors if the audio cannot be played (e.g., autoplay policies).
 * @param {HTMLAudioElement} sound - The audio element to play.
 */
function playSound(sound) {
    if (soundEnabled && sound) {
        sound.play().catch(e => console.warn("Error playing sound:", e.message));
    }
}


// --- Piece Unicode Mapping ---
const pieceUnicode = {
    'p': '♙', 'n': '♘', 'b': '♗', 'r': '♖', 'q': '♕', 'k': '♔',
    'P': '♟', 'N': '♞', 'B': '♝', 'R': '♜', 'Q': '♛', 'K': '♚'
};

// --- Utility Functions ---

function getPieceHTML(piece) {
    if (!piece) return '';
    const unicode = pieceUnicode[piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase()];
    const colorClass = piece.color === 'w' ? 'white' : 'black';
    return `<span class="piece ${colorClass}" data-piece="${piece.type}" data-color="${piece.color}">${unicode}</span>`;
}

function updateBoardUI(board, lastMove = null) {
    if (!chessboard) {
        console.error("Chessboard element not found. Cannot update UI.");
        return;
    }
    chessboard.innerHTML = ''; // Clear existing board
    const rankCoords = ['8', '7', '6', '5', '4', '3', '2', '1'];
    const fileCoords = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Update coordinates display
    if (rankCoordsElem) rankCoordsElem.innerHTML = '';
    if (fileCoordsElem) fileCoordsElem.innerHTML = '';

    const displayRankCoords = isBoardFlipped ? [...rankCoords] : [...rankCoords].reverse();
    const displayFileCoords = isBoardFlipped ? [...fileCoords].reverse() : [...fileCoords];

    displayRankCoords.forEach(rank => {
        if (rankCoordsElem) {
            const span = document.createElement('span');
            span.textContent = rank;
            rankCoordsElem.appendChild(span);
        }
    });

    displayFileCoords.forEach(file => {
        if (fileCoordsElem) {
            const span = document.createElement('span');
            span.textContent = file;
            fileCoordsElem.appendChild(span);
        }
    });


    if (isBoardFlipped) {
        chessboard.classList.add('flipped');
    } else {
        chessboard.classList.remove('flipped');
    }

    board.forEach((row, rowIndex) => {
        row.forEach((piece, colIndex) => {
            const square = document.createElement('div');
            square.classList.add('square');
            // Determine square color
            const isLight = (rowIndex + colIndex) % 2 === 0;
            square.classList.add(isLight ? 'light' : 'dark');

            // Add ID for easy access and coordinate tracking
            const file = String.fromCharCode(97 + colIndex); // 'a' through 'h'
            const rank = 8 - rowIndex;
            const squareId = `${file}${rank}`;
            square.id = `s-${squareId}`; // e.g., s-a1, s-h8
            square.dataset.row = rowIndex;
            square.dataset.col = colIndex;
            square.dataset.squareId = squareId; // Store FEN square notation

            // Add piece if exists
            if (piece) {
                square.innerHTML = getPieceHTML(piece);
            }

            // Highlight last move
            if (lastMove) {
                const fromSquareId = `s-${lastMove.from}`;
                const toSquareId = `s-${lastMove.to}`;
                if (square.id === fromSquareId || square.id === toSquareId) {
                    square.classList.add('bg-yellow-400', 'bg-opacity-50'); // Highlight squares involved in the last move
                }
            }
            chessboard.appendChild(square);
        });
    });
}


function renderBoard(boardData, lastMove = null) {
    currentBoard = boardData;
    updateBoardUI(currentBoard, lastMove);
    addDragDropListeners(); // Crucial: Attach listeners after rendering
}

function updateScoreboard(whiteScore, blackScore, capturedPiecesWhite, capturedPiecesBlack) {
    if (whiteScoreElem) whiteScoreElem.textContent = whiteScore;
    if (blackScoreElem) blackScoreElem.textContent = blackScore;

    if (whiteCapturedPieces) whiteCapturedPieces.innerHTML = '';
    if (blackCapturedPieces) blackCapturedPieces.innerHTML = '';

    // Render captured pieces
    capturedPiecesWhite.forEach(pieceChar => {
        if (whiteCapturedPieces) {
            const span = document.createElement('span');
            span.classList.add('captured-piece', 'black'); // Captured black pieces shown on white's side
            span.textContent = pieceUnicode[pieceChar.toLowerCase()];
            whiteCapturedPieces.appendChild(span);
        }
    });

    capturedPiecesBlack.forEach(pieceChar => {
        if (blackCapturedPieces) {
            const span = document.createElement('span');
            span.classList.add('captured-piece', 'white'); // Captured white pieces shown on black's side
            span.textContent = pieceUnicode[pieceChar.toUpperCase()];
            blackCapturedPieces.appendChild(span);
        }
    });

    // Animate score update (optional, but nice)
    if (whiteScoreElem) whiteScoreElem.classList.add('score-update');
    if (blackScoreElem) blackScoreElem.classList.add('score-update');
    setTimeout(() => {
        if (whiteScoreElem) whiteScoreElem.classList.remove('score-update');
        if (blackScoreElem) blackScoreElem.classList.remove('score-update');
    }, 500);
}

function updateTurnIndicator(turn) {
    gameTurn = turn;
    const turnColor = turn === 'w' ? 'White' : 'Black';
    if (currentTurnElem) currentTurnElem.textContent = turnColor;
    if (turnIndicator) turnIndicator.textContent = `${turnColor}'s Turn`;

    // Highlight active player card based on player's role and current turn
    whitePlayerCard?.classList.remove('your-turn');
    blackPlayerCard?.classList.remove('your-turn');
    whiteStatusIndicator?.classList.remove('status-active', 'status-inactive', 'status-waiting');
    blackStatusIndicator?.classList.remove('status-active', 'status-inactive', 'status-waiting');


    if (playerColor === 'white') {
        if (turn === 'w') {
            whitePlayerCard?.classList.add('your-turn');
            whiteStatusIndicator?.classList.add('status-active');
            blackStatusIndicator?.classList.add('status-inactive');
        } else {
            blackPlayerCard?.classList.add('your-turn'); // Opponent's turn
            whiteStatusIndicator?.classList.add('status-inactive');
            blackStatusIndicator?.classList.add('status-active');
        }
    } else if (playerColor === 'black') {
        if (turn === 'b') {
            blackPlayerCard?.classList.add('your-turn');
            blackStatusIndicator?.classList.add('status-active');
            whiteStatusIndicator?.classList.add('status-inactive');
        } else {
            whitePlayerCard?.classList.add('your-turn'); // Opponent's turn
            blackStatusIndicator?.classList.add('status-inactive');
            whiteStatusIndicator?.classList.add('status-active');
        }
    } else { // Spectator mode
        if (turn === 'w') {
            whiteStatusIndicator?.classList.add('status-active');
            blackStatusIndicator?.classList.add('status-inactive');
        } else {
            blackStatusIndicator?.classList.add('status-active');
            whiteStatusIndicator?.classList.add('status-inactive');
        }
    }
}

function updateMoveCount(count) {
    if (moveCountElem) moveCountElem.textContent = Math.ceil(count / 2); // Display full moves (2 half-moves per full move)
}

function updateGameTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (gameTimeElem) gameTimeElem.textContent = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function showWaitingOverlay(message) {
    if (waitingMessage) waitingMessage.textContent = message;
    if (waitingOverlay) waitingOverlay.style.display = 'flex';
}

function hideWaitingOverlay() {
    if (waitingOverlay) waitingOverlay.style.display = 'none';
}

function showCelebrationModal(message) {
    if (celebrationMessage) celebrationMessage.textContent = message;
    if (celebrationModal) {
        celebrationModal.style.display = 'flex';
        // Add confetti animation
        // Clear previous confetti
        celebrationModal.querySelectorAll('.confetti').forEach(c => c.remove());

        const celebrationContent = celebrationModal.querySelector('.celebration-content');
        if (celebrationContent) {
            for (let i = 0; i < 50; i++) {
                const confetti = document.createElement('div');
                confetti.classList.add('confetti');
                confetti.style.left = `${Math.random() * 100}%`;
                confetti.style.animationDuration = `${2 + Math.random() * 3}s`;
                confetti.style.animationDelay = `${Math.random() * 2}s`;
                celebrationContent.appendChild(confetti);
            }
        }
        playSound(gameOverSound);
    }
}

function hideCelebration() {
    if (celebrationModal) {
        celebrationModal.style.display = 'none';
        // Reset content to ensure confetti is removed
        const celebrationContent = celebrationModal.querySelector('.celebration-content');
        if (celebrationContent) {
            celebrationContent.innerHTML = `
                <h2 id="celebration-message" class="text-4xl font-bold text-white mb-4"></h2>
                <p class="text-lg text-gray-300 mb-6">Game Over!</p>
                <button onclick="hideCelebration()" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-lg">
                    Close
                </button>
            `;
            // Re-set the celebration message element reference as innerHTML was reset
            // *** CORRECTION START ***
            celebrationMessage = document.getElementById('celebration-message'); // This line was causing the error
            // *** CORRECTION END ***
        }
    }
}

function updateConnectionStatus(status) {
    if (connectionStatusElem) {
        connectionStatusElem.className = `connection-status ${status}`;
        if (status === 'connected') {
            connectionStatusElem.textContent = '✅ Connected';
        } else if (status === 'disconnected') {
            connectionStatusElem.textContent = '❌ Disconnected';
        } else if (status === 'connecting') {
            connectionStatusElem.textContent = '🔄 Connecting...';
        }
    }
}

function updateMoveHistory(history) {
    if (!moveHistoryElem) return;
    moveHistoryElem.innerHTML = ''; // Clear previous history
    if (history.length === 0) {
        moveHistoryElem.innerHTML = '<div class="text-sm text-gray-400 text-center">Game hasn\'t started yet</div>';
        return;
    }

    history.forEach((move, index) => {
        const moveItem = document.createElement('div');
        moveItem.classList.add('move-item', 'text-gray-200');
        moveItem.textContent = `${Math.ceil((index + 1) / 2)}. ${move.color === 'w' ? 'White' : 'Black'}: ${move.san}`;
        moveHistoryElem.appendChild(moveItem);
    });
    moveHistoryElem.scrollTop = moveHistoryElem.scrollHeight; // Scroll to bottom
}

// --- Drag and Drop Logic ---

function addDragDropListeners() {
    if (!chessboard) return; // Ensure chessboard exists before adding listeners
    const pieces = chessboard.querySelectorAll('.piece');
    let draggedPieceElement = null; // Store the HTML element being dragged

    pieces.forEach(piece => {
        // Ensure only the current player's pieces are draggable and it's their turn
        const pieceColor = piece.dataset.color; // 'w' or 'b'
        const isCurrentPlayerPiece = (playerColor === 'white' && pieceColor === 'w') ||
                                     (playerColor === 'black' && pieceColor === 'b');

        if (gameActive && gameTurn === pieceColor && isCurrentPlayerPiece) {
            piece.classList.add('draggable');
            piece.setAttribute('draggable', true);
        } else {
            piece.classList.remove('draggable');
            piece.removeAttribute('draggable');
        }

        piece.addEventListener('dragstart', (e) => {
            if (!e.target.classList.contains('draggable')) {
                e.preventDefault();
                return;
            }
            draggedPieceElement = e.target;
            selectedPieceSquare = draggedPieceElement.closest('.square'); // Get the square element
            if (selectedPieceSquare) {
                selectedPieceSquare.classList.add('bg-blue-400', 'bg-opacity-50'); // Highlight selected square
            }
            draggedPieceElement.classList.add('dragging');

            // Request valid moves from server for the selected piece
            const fromSq = selectedPieceSquare?.dataset.squareId; // Use optional chaining for safety
            if (fromSq && socket) { // Ensure socket exists
                socket.emit('requestValidMoves', { from: fromSq });
            }
        });

        piece.addEventListener('dragend', () => {
            if (draggedPieceElement) {
                draggedPieceElement.classList.remove('dragging');
                draggedPieceElement = null;
            }
            // Add null check for selectedPieceSquare
            if (selectedPieceSquare) {
                selectedPieceSquare.classList.remove('bg-blue-400', 'bg-opacity-50'); // Remove highlight
            }
            // Remove valid move highlights
            document.querySelectorAll('.square.valid-move').forEach(s => s.classList.remove('valid-move'));
            selectedPieceSquare = null;
            validMoves = [];
        });
    });

    const squares = chessboard.querySelectorAll('.square');
    squares.forEach(square => {
        square.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
        });

        square.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!draggedPieceElement || !selectedPieceSquare) return; // Ensure a piece was actually dragged

            const fromSq = selectedPieceSquare.dataset.squareId;
            const toSq = e.currentTarget.dataset.squareId;

            // Check if it's a valid move using the received list
            const isValid = validMoves.some(move => move.to === toSq);

            if (isValid) {
                const pieceType = draggedPieceElement.dataset.piece;
                const pieceColor = draggedPieceElement.dataset.color;
                const targetRank = Number(toSq[1]); // Use Number() for clarity

                const isPawnPromotion = (pieceType === 'p' && (
                    (pieceColor === 'w' && targetRank === 8) ||
                    (pieceColor === 'b' && targetRank === 1)
                ));

                if (isPawnPromotion) {
                    promptForPromotion(fromSq, toSq);
                } else {
                    if (socket) socket.emit('move', { from: fromSq, to: toSq });
                }
            } else {
                console.log('Invalid move attempt from drag/drop.');
                playSound(clickSound); // Play a "fail" sound
            }

            // Clean up drag state regardless of move validity
            if (draggedPieceElement) {
                draggedPieceElement.classList.remove('dragging');
                draggedPieceElement = null;
            }
            if (selectedPieceSquare) {
                selectedPieceSquare.classList.remove('bg-blue-400', 'bg-opacity-50');
            }
            document.querySelectorAll('.square.valid-move').forEach(s => s.classList.remove('valid-move'));
            selectedPieceSquare = null;
            validMoves = [];
        });


        // --- Click-to-Move Logic ---
        square.addEventListener('click', (e) => {
            const clickedSquare = e.currentTarget;
            const clickedPiece = clickedSquare.querySelector('.piece');
            const clickedSqId = clickedSquare.dataset.squareId;

            // If a piece is already selected
            if (selectedPieceSquare) {
                const fromSq = selectedPieceSquare.dataset.squareId;
                const toSq = clickedSqId;

                // Check if the clicked square is a valid target for the selected piece
                const isValid = validMoves.some(move => move.to === toSq);

                if (isValid) {
                    const pieceType = selectedPieceSquare.querySelector('.piece')?.dataset.piece; // Optional chaining
                    const pieceColor = selectedPieceSquare.querySelector('.piece')?.dataset.color; // Optional chaining
                    const targetRank = Number(toSq[1]);

                    const isPawnPromotion = (pieceType === 'p' && (
                        (pieceColor === 'w' && targetRank === 8) ||
                        (pieceColor === 'b' && targetRank === 1)
                    ));

                    if (isPawnPromotion) {
                        promptForPromotion(fromSq, toSq);
                    } else {
                        if (socket) socket.emit('move', { from: fromSq, to: toSq });
                    }
                } else if (clickedPiece) {
                    // If clicking on a new piece:
                    const pieceColor = clickedPiece.dataset.color;
                    const isCurrentPlayerPiece = (playerColor === 'white' && pieceColor === 'w') ||
                                                 (playerColor === 'black' && pieceColor === 'b');

                    if (isCurrentPlayerPiece && gameActive && gameTurn === pieceColor) {
                        // Deselect previous
                        selectedPieceSquare.classList.remove('bg-blue-400', 'bg-opacity-50');
                        document.querySelectorAll('.square.valid-move').forEach(s => s.classList.remove('valid-move'));

                        // Select new piece
                        selectedPieceSquare = clickedSquare;
                        selectedPieceSquare.classList.add('bg-blue-400', 'bg-opacity-50');
                        if (socket) socket.emit('requestValidMoves', { from: clickedSqId });
                    } else {
                        // Clicking on an opponent's piece or invalid move target, deselect
                        selectedPieceSquare.classList.remove('bg-blue-400', 'bg-opacity-50');
                        document.querySelectorAll('.square.valid-move').forEach(s => s.classList.remove('valid-move'));
                        selectedPieceSquare = null;
                        validMoves = [];
                        playSound(clickSound); // Play a "fail" sound
                    }
                } else {
                    // Clicking on an empty square that is not a valid move target, deselect
                    selectedPieceSquare.classList.remove('bg-blue-400', 'bg-opacity-50');
                    document.querySelectorAll('.square.valid-move').forEach(s => s.classList.remove('valid-move'));
                    selectedPieceSquare = null;
                    validMoves = [];
                    playSound(clickSound); // Play a "fail" sound
                }
            } else {
                // No piece selected, try to select one
                if (clickedPiece) {
                    const pieceColor = clickedPiece.dataset.color;
                    const isCurrentPlayerPiece = (playerColor === 'white' && pieceColor === 'w') ||
                                                 (playerColor === 'black' && pieceColor === 'b');
                    if (isCurrentPlayerPiece && gameActive && gameTurn === pieceColor) {
                        selectedPieceSquare = clickedSquare;
                        selectedPieceSquare.classList.add('bg-blue-400', 'bg-opacity-50');
                        if (socket) socket.emit('requestValidMoves', { from: clickedSqId });
                    } else {
                        // Clicked on opponent's piece or a spectator tried to click
                        playSound(clickSound);
                    }
                } else {
                    // Clicked on empty square with no piece selected
                    playSound(clickSound);
                }
            }
        });
    });
}

function promptForPromotion(fromSq, toSq) {
    const promotionPieces = ['q', 'r', 'b', 'n']; // Queen, Rook, Bishop, Knight
    const playerColorPrefix = playerColor === 'white' ? 'w' : 'b';

    const modal = document.createElement('div');
    modal.classList.add('fixed', 'inset-0', 'bg-black', 'bg-opacity-75', 'flex', 'items-center', 'justify-center', 'z-50');
    modal.innerHTML = `
        <div class="bg-slate-700 p-8 rounded-lg shadow-xl text-center">
            <h3 class="text-xl font-bold text-white mb-4">Promote Pawn to:</h3>
            <div class="flex justify-center gap-4">
                ${promotionPieces.map(pieceType => `
                    <button class="promotion-option bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-3xl transition-colors duration-200"
                            data-promotion="${pieceType}">
                        ${pieceUnicode[playerColorPrefix === 'w' ? pieceType.toUpperCase() : pieceType.toLowerCase()]}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.promotion-option').forEach(button => {
        button.addEventListener('click', () => {
            const promotionType = button.dataset.promotion;
            if (socket) socket.emit('move', { from: fromSq, to: toSq, promotion: promotionType });
            document.body.removeChild(modal);
            // After promotion, clear selected state and highlights
            if (selectedPieceSquare) {
                selectedPieceSquare.classList.remove('bg-blue-400', 'bg-opacity-50');
            }
            document.querySelectorAll('.square.valid-move').forEach(s => s.classList.remove('valid-move'));
            selectedPieceSquare = null;
            validMoves = [];
        });
    });
}


let socket; // Declared at the top, outside the DOMContentLoaded for broader scope

// --- Socket.IO Event Handlers ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if io is defined (Socket.IO client library loaded)
    if (typeof io === 'undefined') {
        console.error("Socket.IO client library not found. Please ensure 'socket.io.js' is loaded before 'script.js'.");
        updateConnectionStatus('disconnected');
        gameStatusElem.textContent = 'Error: Socket.IO library missing.';
        return;
    }

    socket = io('http://localhost:3000/');
    updateConnectionStatus('connecting');

    socket.on('connect', () => {
        console.log('Connected to server!');
        updateConnectionStatus('connected');
        // Request initial state for a potentially reconnecting player or to get assigned to a game
        socket.emit('requestInitialState');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
        updateConnectionStatus('disconnected');
        gameActive = false;
        clearInterval(gameInterval);
        if (gameStatusElem) gameStatusElem.textContent = 'Disconnected from server.';
        showWaitingOverlay("You have been disconnected. Please refresh to reconnect.");
    });

    socket.on('connect_error', (err) => {
        console.error('Connection Error:', err);
        updateConnectionStatus('disconnected');
        if (gameStatusElem) gameStatusElem.textContent = 'Connection error. Please check your internet.';
        showWaitingOverlay("Connection error. Please refresh the page.");
    });

    socket.on('playerRole', ({ role, gameId }) => {
        playerColor = role;
        if (playerRoleElem) playerRoleElem.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        if (roleBadge) {
            roleBadge.textContent = role.charAt(0).toUpperCase() + role.slice(1);
            roleBadge.className = `role-badge ${role === 'white' ? 'role-white' : role === 'black' ? 'role-black' : 'role-spectator'}`;
        }
        console.log(`You are playing as: ${role}`);

        isBoardFlipped = (playerColor === 'black'); // Flip if black, unflip if white or spectator
        // Board rendering will be handled by gameStart/boardUpdate or requestBoardStateResponse
    });

    socket.on('spectatorCount', (count) => {
        if (spectatorCountElem) spectatorCountElem.textContent = count;
    });

    socket.on('waitingForPlayer', ({ message }) => {
        showWaitingOverlay(message);
        gameActive = false;
        clearInterval(gameInterval); // Stop any existing timer
        if (chessboard) chessboard.innerHTML = ''; // Clear board
        if (gameStatusElem) gameStatusElem.textContent = 'Waiting for players...';
        if (currentTurnElem) currentTurnElem.textContent = 'N/A';
        if (turnIndicator) turnIndicator.textContent = 'Waiting...';
        if (moveCountElem) moveCountElem.textContent = '0';
        if (gameTimeElem) gameTimeElem.textContent = '0:00';
        if (whiteCapturedPieces) whiteCapturedPieces.innerHTML = '';
        if (blackCapturedPieces) blackCapturedPieces.innerHTML = '';
        if (whiteScoreElem) whiteScoreElem.textContent = '0';
        if (blackScoreElem) blackScoreElem.textContent = '0';
        updateMoveHistory([]); // Always call the function, it handles empty state
        totalCaptures = 0;
        checksGiven = 0;
        if (totalCapturesElem) totalCapturesElem.textContent = '0';
        if (checksGivenElem) checksGivenElem.textContent = '0';
        whitePlayerCard?.classList.remove('your-turn');
        blackPlayerCard?.classList.remove('your-turn');
        whiteStatusIndicator?.classList.remove('status-active', 'status-inactive', 'status-waiting');
        whiteStatusIndicator?.classList.add('status-waiting');
        blackStatusIndicator?.classList.remove('status-active', 'status-inactive', 'status-waiting');
        blackStatusIndicator?.classList.add('status-waiting');
        hideCelebration(); // Hide any lingering celebration
    });

    socket.on('hideWaitingOverlay', () => {
        hideWaitingOverlay();
    });


    socket.on('gameStart', ({ board, turn, whiteScore, blackScore, moveCount, whitePlayerId, blackPlayerId }) => {
        hideWaitingOverlay();
        gameActive = true;
        gameStartTime = 0; // Reset client-side timer
        clearInterval(gameInterval); // Clear any old timer
        gameInterval = setInterval(() => {
            gameStartTime++;
            updateGameTime(gameStartTime);
        }, 1000);

        renderBoard(board);
        updateTurnIndicator(turn);
        updateScoreboard(whiteScore, blackScore, [], []); // Start with empty captured arrays
        updateMoveCount(moveCount);
        updateMoveHistory([]); // Clear move history
        if (gameStatusElem) gameStatusElem.textContent = 'Game in Progress';
        totalCaptures = 0;
        checksGiven = 0;
        if (totalCapturesElem) totalCapturesElem.textContent = '0';
        if (checksGivenElem) checksGivenElem.textContent = '0';

        // Update player status indicators
        // The updateTurnIndicator function already handles this logic based on playerColor and turn.
        updateTurnIndicator(turn);

        console.log('Game started!');
    });

    socket.on('boardUpdate', ({ board, turn, lastMove, moveCount, whiteScore, blackScore, capturedPiece, isCheck, history, capturedWhite, capturedBlack }) => {
        renderBoard(board, lastMove);
        updateTurnIndicator(turn);
        updateMoveCount(moveCount);
        updateMoveHistory(history);
        updateScoreboard(whiteScore, blackScore, capturedWhite, capturedBlack); // Always update scores and captured pieces

        if (capturedPiece) {
            playSound(captureSound);
            totalCaptures++;
            if (totalCapturesElem) totalCapturesElem.textContent = totalCaptures;
        } else {
            playSound(moveSound); // Play move sound if no capture
        }

        if (isCheck) {
            playSound(checkSound);
            checksGiven++;
            if (checksGivenElem) checksGivenElem.textContent = checksGiven;
            if (gameStatusElem) {
                gameStatusElem.textContent = `${turn === 'w' ? 'Black' : 'White'} is in Check!`;
                gameStatusElem.classList.add('text-red-500');
            }
        } else {
            if (gameStatusElem) {
                gameStatusElem.textContent = 'Game in Progress';
                gameStatusElem.classList.remove('text-red-500');
            }
        }
    });

    socket.on('invalidMove', ({ message }) => {
        console.warn('Invalid move:', message);
        if (gameStatusElem) {
            gameStatusElem.textContent = `Invalid Move: ${message}`;
            gameStatusElem.classList.add('text-red-500');
        }
        playSound(clickSound); // Play a "fail" sound
        setTimeout(() => {
            if (gameStatusElem) {
                gameStatusElem.classList.remove('text-red-500');
                gameStatusElem.textContent = gameActive ? 'Game in Progress' : 'Waiting for players...';
            }
        }, 3000);
        // Request current board state from server to resync UI if client state is wrong
        socket.emit('requestInitialState'); // More robust than just requestBoardState
    });

    socket.on('requestValidMovesResponse', ({ moves }) => {
        validMoves = moves;
        // Highlight valid move squares
        document.querySelectorAll('.square.valid-move').forEach(s => s.classList.remove('valid-move')); // Clear previous
        moves.forEach(move => {
            const targetSquare = document.getElementById(`s-${move.to}`);
            if (targetSquare) {
                targetSquare.classList.add('valid-move');
            }
        });
    });

    socket.on('gameTimeUpdate', (seconds) => {
        if (gameActive) { // Only update if game is active
            updateGameTime(seconds);
        }
    });

    socket.on('gameOver', ({ winner, reason }) => {
        gameActive = false;
        clearInterval(gameInterval);
        if (gameStatusElem) gameStatusElem.textContent = `Game Over! ${winner} wins by ${reason}!`;
        showCelebrationModal(`${winner} Wins!`);
        console.log(`Game Over: ${winner} wins by ${reason}`);
    });

    socket.on('gameReset', () => {
        gameActive = false;
        clearInterval(gameInterval);
        if (gameStatusElem) gameStatusElem.textContent = 'Game Reset. Waiting for players...';
        if (currentTurnElem) currentTurnElem.textContent = 'N/A';
        if (turnIndicator) turnIndicator.textContent = 'Waiting...';
        if (moveCountElem) moveCountElem.textContent = '0';
        if (gameTimeElem) gameTimeElem.textContent = '0:00';
        if (whiteCapturedPieces) whiteCapturedPieces.innerHTML = '';
        if (blackCapturedPieces) blackCapturedPieces.innerHTML = '';
        if (whiteScoreElem) whiteScoreElem.textContent = '0';
        if (blackScoreElem) blackScoreElem.textContent = '0';
        updateMoveHistory([]);
        totalCaptures = 0;
        checksGiven = 0;
        if (totalCapturesElem) totalCapturesElem.textContent = '0';
        if (checksGivenElem) checksGivenElem.textContent = '0';
        whitePlayerCard?.classList.remove('your-turn');
        blackPlayerCard?.classList.remove('your-turn');
        whiteStatusIndicator?.classList.remove('status-active', 'status-inactive', 'status-waiting');
        whiteStatusIndicator?.classList.add('status-waiting');
        blackStatusIndicator?.classList.remove('status-active', 'status-inactive', 'status-waiting');
        blackStatusIndicator?.classList.add('status-waiting');
        hideCelebration(); // Ensure celebration modal is hidden
    });

    // Add event listeners for newGameBtn, soundToggleBtn, volumeSlider if they exist
    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            if (socket) socket.emit('newGame');
        });
    }

    if (soundToggleBtn) {
        soundToggleBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            if (soundEnabled) {
                soundToggleBtn.textContent = 'ON';
                soundToggleBtn.classList.remove('bg-gray-600');
                soundToggleBtn.classList.add('bg-green-600');
                if (volumeSlider) volumeSlider.disabled = false;
            } else {
                soundToggleBtn.textContent = 'OFF';
                soundToggleBtn.classList.remove('bg-green-600');
                soundToggleBtn.classList.add('bg-gray-600');
                if (volumeSlider) volumeSlider.disabled = true;
            }
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            if (moveSound) moveSound.volume = volume;
            if (captureSound) captureSound.volume = volume;
            if (checkSound) checkSound.volume = volume;
            if (gameOverSound) gameOverSound.volume = volume;
            if (clickSound) clickSound.volume = volume;
        });
    }
});