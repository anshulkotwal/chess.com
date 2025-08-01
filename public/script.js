// Enhanced Chess Client Script with Audio Integration - COMPLETE FIXED VERSION

// --- Global Variables ---
let socket;
let gameState = {
    board: [],
    turn: 'w',
    playerColor: null,
    playerRole: 'spectator',
    roomId: null,
    roomCode: null,
    gameActive: false,
    timeControl: null,
    timers: { white: null, black: null },
    selectedSquare: null,
    validMoves: [],
    moveHistory: [],
    stats: {},
    players: { white: null, black: null }
};

let username = '';
let queueType = null;
let soundEnabled = true;
let gameDurationInterval = null;
let gameStartTime = null;

// --- DOM Elements ---
const elements = {
    // Modals
    mainMenu: document.getElementById('main-menu'),
    queueModal: document.getElementById('queue-modal'),
    gameInterface: document.getElementById('game-interface'),
    drawOfferModal: document.getElementById('draw-offer-modal'),
    gameEndModal: document.getElementById('game-end-modal'),
    timeControlModal: document.getElementById('time-control-modal'),
    roomCodeModal: document.getElementById('room-code-modal'),
    
    // Main menu
    usernameInput: document.getElementById('username-input'),
    casualBtn: document.getElementById('casual-btn'),
    rankedBtn: document.getElementById('ranked-btn'),
    createRoomBtn: document.getElementById('create-room-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    initialTimeInput: document.getElementById('initial-time'),
    incrementTimeInput: document.getElementById('increment-time'),
    roomCodeInput: document.getElementById('room-code-input'),
    confirmCreateRoomBtn: document.getElementById('confirm-create-room'),
    cancelCreateRoomBtn: document.getElementById('cancel-create-room'),
    confirmJoinRoomBtn: document.getElementById('confirm-join-room'),
    cancelJoinRoomBtn: document.getElementById('cancel-join-room'),
    
    // Queue
    queueMessage: document.getElementById('queue-message'),
    queuePosition: document.getElementById('queue-position'),
    leaveQueueBtn: document.getElementById('leave-queue-btn'),
    
    // Game interface
    chessboard: document.getElementById('chessboard'),
    gameStatus: document.getElementById('game-status'),
    roomInfo: document.getElementById('room-info'),
    playerRole: document.getElementById('player-role'),
    spectatorCount: document.getElementById('spectator-count'),
    spectatorCountDisplay: document.getElementById('spectator-count-display'),
    turnIndicator: document.getElementById('turn-indicator'),
    
    // Player cards and timers
    whitePlayerCard: document.getElementById('white-player-card'),
    blackPlayerCard: document.getElementById('black-player-card'),
    whiteTimer: document.getElementById('white-timer'),
    blackTimer: document.getElementById('black-timer'),
    whitePlayerName: document.getElementById('white-player-name'),
    blackPlayerName: document.getElementById('black-player-name'),
    whiteRating: document.getElementById('white-rating'),
    blackRating: document.getElementById('black-rating'),
    
    // Controls
    resignBtn: document.getElementById('resign-btn'),
    drawBtn: document.getElementById('draw-btn'),
    newGameBtn: document.getElementById('new-game-btn'),
    
    // Move history and chat
    moveHistory: document.getElementById('move-history'),
    chatContainer: document.getElementById('chat-container'),
    chatInput: document.getElementById('chat-input'),
    sendChatBtn: document.getElementById('send-chat-btn'),
    
    // Stats
    moveCount: document.getElementById('move-count'),
    gameDuration: document.getElementById('game-duration'),
    
    // Connection status
    connectionStatus: document.getElementById('connection-status'),
    
    // Draw offer modal
    drawOfferMessage: document.getElementById('draw-offer-message'),
    acceptDrawBtn: document.getElementById('accept-draw-btn'),
    declineDrawBtn: document.getElementById('decline-draw-btn'),
    
    // Game end modal
    gameEndTitle: document.getElementById('game-end-title'),
    gameEndMessage: document.getElementById('game-end-message'),
    gameEndStats: document.getElementById('game-end-stats'),
    closeGameEndBtn: document.getElementById('close-game-end-btn'),
    
    // Audio and effects
    soundControl: document.getElementById('sound-control'),
    celebrationOverlay: document.getElementById('celebration-overlay'),
    lossOverlay: document.getElementById('loss-overlay'),
    
    // Audio elements
    moveSound: document.getElementById('move-sound'),
    captureSound: document.getElementById('capture-sound'),
    checkSound: document.getElementById('check-sound'),
    castleSound: document.getElementById('castle-sound'),
    promoteSound: document.getElementById('promote-sound'),
    gameOverSound: document.getElementById('game-over-sound'),
    victorySound: document.getElementById('victory-sound'),
    defeatSound: document.getElementById('defeat-sound')
};

// --- Piece Unicode Mapping ---
const pieceUnicode = {
    'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙', // White pieces
    'K': '♚', 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞', 'P': '♟'  // Black pieces
};

// --- Audio Functions ---
function toggleSound() {
    soundEnabled = !soundEnabled;
    elements.soundControl.textContent = soundEnabled ? '🔊' : '🔇';
    elements.soundControl.classList.toggle('muted', !soundEnabled);
    
    // Store preference
    localStorage.setItem('chessGameSoundEnabled', soundEnabled.toString());
}

function playSound(soundType) {
    if (!soundEnabled) return;
    
    try {
        const soundElement = elements[soundType];
        if (soundElement) {
            soundElement.currentTime = 0;
            soundElement.play().catch(error => {
                console.log('Audio play prevented:', error);
            });
        }
    } catch (error) {
        console.log('Audio error:', error);
    }
}

function createConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            confetti.remove();
        }, 5000);
    }
}

function createFireworks() {
    const colors = ['#ffd700', '#ff4500', '#ff1493', '#00ff00', '#1e90ff'];
    
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = Math.random() * 100 + 'vw';
            firework.style.top = Math.random() * 100 + 'vh';
            firework.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            document.body.appendChild(firework);
            
            setTimeout(() => {
                firework.remove();
            }, 2000);
        }, i * 200);
    }
}

function showCelebrationEffect() {
    elements.celebrationOverlay.classList.remove('hidden');
    createConfetti();
    createFireworks();
    playSound('victorySound');
    
    setTimeout(() => {
        elements.celebrationOverlay.classList.add('hidden');
    }, 3000);
}

function showDefeatEffect() {
    elements.lossOverlay.classList.remove('hidden');
    playSound('defeatSound');
    
    setTimeout(() => {
        elements.lossOverlay.classList.add('hidden');
    }, 2000);
}

// --- Utility Functions ---
function formatTime(milliseconds) {
    if (!milliseconds || milliseconds < 0) return '0:00';
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDuration(milliseconds) {
    if (!milliseconds) return '0:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('hidden');
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('hidden');
    }
}

function updateConnectionStatus(status) {
    const statusElement = elements.connectionStatus;
    if (statusElement) {
        statusElement.className = `connection-status ${status}`;
        switch (status) {
            case 'connected':
                statusElement.textContent = '✅ Connected';
                break;
            case 'disconnected':
                statusElement.textContent = '❌ Disconnected';
                break;
            case 'connecting':
                statusElement.textContent = '🔄 Connecting...';
                break;
        }
    }
}

// --- Game Duration Timer ---
function startGameDurationTimer() {
    gameStartTime = Date.now();
    
    gameDurationInterval = setInterval(() => {
        if (gameStartTime) {
            const duration = Date.now() - gameStartTime;
            elements.gameDuration.textContent = formatDuration(duration);
        }
    }, 1000);
}

function stopGameDurationTimer() {
    if (gameDurationInterval) {
        clearInterval(gameDurationInterval);
        gameDurationInterval = null;
    }
}

// --- Board Rendering ---
function getPieceHTML(piece) {
    if (!piece) return '';
    
    // Convert chess.js piece format to display format
    const pieceKey = piece.color === 'w' ? piece.type.toLowerCase() : piece.type.toUpperCase();
    const unicode = pieceUnicode[pieceKey];
    const colorClass = piece.color === 'w' ? 'white' : 'black';
    
    return `<span class="piece ${colorClass}" data-piece="${piece.type}" data-color="${piece.color}">${unicode}</span>`;
}

function renderBoard(board, lastMove = null) {
    if (!elements.chessboard || !board) return;
    
    elements.chessboard.innerHTML = '';
    gameState.board = board;
    
    const isFlipped = gameState.playerColor === 'black';
    
    // Render 8x8 board
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            
            // Determine square color
            const isLight = (row + col) % 2 === 0;
            square.classList.add(isLight ? 'light' : 'dark');
            
            // Calculate square notation
            const file = String.fromCharCode(97 + col); // a-h
            const rank = 8 - row; // 8-1
            const squareId = `${file}${rank}`;
            
            square.id = `square-${squareId}`;
            square.dataset.square = squareId;
            square.dataset.row = row;
            square.dataset.col = col;
            
            // Add piece if exists
            const piece = board[row] && board[row][col];
            if (piece) {
                square.innerHTML = getPieceHTML(piece);
            }
            
            // Highlight last move
            if (lastMove && (lastMove.from === squareId || lastMove.to === squareId)) {
                square.classList.add('last-move');
            }
            
            elements.chessboard.appendChild(square);
        }
    }
    
    // Apply board flip
    if (isFlipped) {
        elements.chessboard.classList.add('flipped');
    } else {
        elements.chessboard.classList.remove('flipped');
    }
    
    addBoardEventListeners();
}

function addBoardEventListeners() {
    const squares = elements.chessboard.querySelectorAll('.square');
    
    squares.forEach(square => {
        square.addEventListener('click', handleSquareClick);
        square.addEventListener('dragover', handleDragOver);
        square.addEventListener('drop', handleDrop);
    });

    // Add drag functionality to pieces
    const pieces = elements.chessboard.querySelectorAll('.piece');
    pieces.forEach(piece => {
        if (canPlayerMove()) {
            piece.draggable = true;
            piece.classList.add('draggable');
            piece.addEventListener('dragstart', handleDragStart);
            piece.addEventListener('dragend', handleDragEnd);
        }
    });
}

function handleSquareClick(event) {
    if (!canPlayerMove()) return;
    
    const square = event.currentTarget;
    const squareId = square.dataset.square;
    
    if (gameState.selectedSquare) {
        // Try to make a move
        if (gameState.validMoves.includes(squareId)) {
            makeMove(gameState.selectedSquare, squareId);
        }
        clearSelection();
    } else {
        // Select piece if it belongs to current player
        const piece = square.querySelector('.piece');
        if (piece && isPieceMovable(piece)) {
            selectSquare(squareId);
        }
    }
}

function handleDragStart(event) {
    if (!canPlayerMove()) {
        event.preventDefault();
        return;
    }
    
    const piece = event.target;
    const square = piece.closest('.square');
    const squareId = square.dataset.square;
    
    if (!isPieceMovable(piece)) {
        event.preventDefault();
        return;
    }
    
    event.dataTransfer.setData('text/plain', squareId);
    piece.classList.add('dragging');
    selectSquare(squareId);
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
}

function handleDragOver(event) {
    event.preventDefault();
}

function handleDrop(event) {
    event.preventDefault();
    
    const fromSquare = event.dataTransfer.getData('text/plain');
    const toSquare = event.currentTarget.dataset.square;
    
    if (fromSquare && toSquare && gameState.validMoves.includes(toSquare)) {
        makeMove(fromSquare, toSquare);
    }
    
    clearSelection();
}

function selectSquare(squareId) {
    clearSelection();
    gameState.selectedSquare = squareId;
    
    const square = document.getElementById(`square-${squareId}`);
    if (square) {
        square.classList.add('selected');
        highlightValidMoves(squareId);
    }
}

function clearSelection() {
    // Clear previous selection
    const selectedSquare = elements.chessboard.querySelector('.selected');
    if (selectedSquare) {
        selectedSquare.classList.remove('selected');
    }
    
    gameState.selectedSquare = null;
    gameState.validMoves = [];
    clearValidMoveHighlights();
}

function highlightValidMoves(fromSquare) {
    clearValidMoveHighlights();
    
    // Request valid moves from server
    if (socket && socket.connected) {
        socket.emit('getValidMoves', { from: fromSquare });
    }
}

function clearValidMoveHighlights() {
    const squares = elements.chessboard.querySelectorAll('.square');
    squares.forEach(square => {
        square.classList.remove('valid-move');
    });
}

function canPlayerMove() {
    return gameState.gameActive && 
        gameState.playerRole !== 'spectator' && 
        ((gameState.turn === 'w' && gameState.playerColor === 'white') ||
         (gameState.turn === 'b' && gameState.playerColor === 'black'));
}

function isPieceMovable(piece) {
    const pieceColor = piece.dataset.color;
    return (pieceColor === gameState.playerColor[0] && gameState.turn === pieceColor);
}

function makeMove(from, to) {
    if (!socket || !socket.connected) return;
    
    // Check for pawn promotion
    let promotion = null;
    const piece = document.querySelector(`#square-${from} .piece`);
    if (piece && piece.dataset.piece === 'p') {
        const toRank = parseInt(to[1]);
        if ((gameState.playerColor === 'white' && toRank === 8) ||
            (gameState.playerColor === 'black' && toRank === 1)) {
            promotion = prompt('Promote to (q/r/b/n):', 'q') || 'q';
        }
    }
    
    socket.emit('makeMove', {
        from: from,
        to: to,
        promotion: promotion
    });
}

// --- Socket Event Handlers ---
function initializeSocket() {
    const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : window.location.origin;
    
    socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus('connected');
        
        if (username) {
            socket.emit('setUsername', { username });
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        updateConnectionStatus('disconnected');
    });

    socket.on('connected', (data) => {
        console.log('Server confirmed connection:', data);
    });

    socket.on('usernameSet', (data) => {
        username = data.username;
        console.log('Username set:', username);
    });

    socket.on('queueJoined', (data) => {
        queueType = data.gameType;
        elements.queueMessage.textContent = `Searching for ${data.gameType} game...`;
        elements.queuePosition.textContent = data.position;
        showModal(elements.queueModal);
    });

    socket.on('matchFound', (data) => {
        hideModal(elements.queueModal);
        gameState.roomId = data.roomId;
        gameState.playerColor = data.color;
        gameState.playerRole = data.color;
        console.log('Match found:', data);
        showGameInterface();
    });

    socket.on('roomCreated', (data) => {
        gameState.roomId = data.roomId;
        gameState.roomCode = data.roomCode;
        gameState.playerRole = 'white';
        gameState.playerColor = 'white';
        elements.roomInfo.textContent = data.roomCode || data.roomId;
        showGameInterface();
    });

    socket.on('roomJoined', (data) => {
        gameState.roomId = data.roomId;
        gameState.playerRole = data.role;
        if (data.role !== 'spectator') {
            gameState.playerColor = data.role;
        }
        showGameInterface();
    });

    socket.on('gameStart', (data) => {
        gameState.gameActive = true;
        gameState.turn = data.turn;
        gameState.players = data.players;
        gameState.timeControl = data.timeControl;
        gameState.timers = data.timers;
        gameState.roomCode = data.roomCode;
        
        elements.roomInfo.textContent = data.roomCode || gameState.roomId;
        elements.playerRole.textContent = gameState.playerRole;
        
        // Update player names and ratings
        if (elements.whitePlayerName) {
            elements.whitePlayerName.textContent = data.players.white || 'White Player';
            elements.whiteRating.textContent = data.ratings?.white || '1200';
        }
        if (elements.blackPlayerName) {
            elements.blackPlayerName.textContent = data.players.black || 'Black Player';
            elements.blackRating.textContent = data.ratings?.black || '1200';
        }
        
        renderBoard(data.board);
        updateGameStatus();
        updateTimers();
        startGameDurationTimer();
        
        showGameInterface();
    });

    socket.on('moveUpdate', (data) => {
        gameState.turn = data.turn;
        gameState.timers = data.timers;
        gameState.stats = data.stats;
        
        renderBoard(data.board, data.move);
        addMoveToHistory(data.move);
        updateGameStatus();
        updateTimers();
        updateStats();
    });

    socket.on('timerUpdate', (data) => {
        gameState.timers = data.timers;
        updateTimers();
    });

    socket.on('gameEnd', (data) => {
        gameState.gameActive = false;
        gameState.winner = data.winner;
        gameState.endReason = data.reason;
        
        stopGameDurationTimer();
        
        // Show celebration or defeat effects
        if (data.winner !== 'draw') {
            if ((data.winner === 'white' && gameState.playerColor === 'white') ||
                (data.winner === 'black' && gameState.playerColor === 'black')) {
                showCelebrationEffect();
            } else if (gameState.playerRole !== 'spectator') {
                showDefeatEffect();
            }
        } else {
            playSound('gameOverSound');
        }
        
        showGameEndModal(data);
        updateGameStatus();
    });

    socket.on('chatMessage', (data) => {
        addChatMessage(data);
    });

    socket.on('drawOffer', (data) => {
        elements.drawOfferMessage.textContent = `${data.from} offers a draw.`;
        showModal(elements.drawOfferModal);
    });

    socket.on('drawDeclined', () => {
        addChatMessage({
            type: 'system',
            message: 'Draw offer declined',
            timestamp: new Date()
        });
    });

    socket.on('validMoves', (data) => {
        gameState.validMoves = data.moves;
        data.moves.forEach(move => {
            const square = document.getElementById(`square-${move}`);
            if (square) {
                square.classList.add('valid-move');
            }
        });
    });

    socket.on('moveError', (data) => {
        console.error('Move error:', data.error);
        addChatMessage({
            type: 'error',
            message: `Move error: ${data.error}`,
            timestamp: new Date()
        });
        clearSelection();
    });

    socket.on('playSound', (data) => {
        const soundMap = {
            'moveSound': 'moveSound',
            'captureSound': 'captureSound',
            'checkSound': 'checkSound',
            'castleSound': 'castleSound',
            'promoteSound': 'promoteSound',
            'gameOverSound': 'gameOverSound'
        };
        
        const soundType = soundMap[data.type];
        if (soundType) {
            playSound(soundType);
        }
    });

    socket.on('error', (data) => {
        console.error('Server error:', data.message);
        addChatMessage({
            type: 'error',
            message: data.message,
            timestamp: new Date()
        });
    });

    socket.on('queueLeft', () => {
        hideModal(elements.queueModal);
    });

    socket.on('roomLeft', () => {
        resetGameState();
        hideModal(elements.gameInterface);
        showModal(elements.mainMenu);
    });

    socket.on('roomState', (data) => {
        gameState.stats = data.stats;
        gameState.timers = data.timers;
        gameState.players = data.players;
        gameState.gameActive = data.gameActive;
        
        // Update player names
        if (elements.whitePlayerName) {
            elements.whitePlayerName.textContent = data.players.white || 'Waiting...';
        }
        if (elements.blackPlayerName) {
            elements.blackPlayerName.textContent = data.players.black || 'Waiting...';
        }
        
        renderBoard(data.board);
        updateGameStatus();
        updateTimers();
        updateStats();
        
        if (elements.spectatorCount) {
            elements.spectatorCount.textContent = data.spectators;
        }
        
        // Load chat history
        if (data.chat) {
            data.chat.forEach(msg => addChatMessage(msg));
        }
        
        // Start timer if game is active
        if (data.gameActive && !gameDurationInterval) {
            startGameDurationTimer();
        }
    });
}

// --- UI Update Functions ---
function updateGameStatus() {
    let statusText = 'Game in progress';
    
    if (!gameState.gameActive) {
        if (gameState.winner === 'draw') {
            statusText = `Game drawn by ${gameState.endReason}`;
        } else if (gameState.winner) {
            statusText = `${gameState.winner} wins by ${gameState.endReason}`;
        } else {
            statusText = 'Waiting for players...';
        }
    } else {
        const currentPlayer = gameState.turn === 'w' ? 'White' : 'Black';
        statusText = `${currentPlayer}'s turn`;
        
        if (gameState.playerRole !== 'spectator') {
            if ((gameState.turn === 'w' && gameState.playerColor === 'white') ||
                (gameState.turn === 'b' && gameState.playerColor === 'black')) {
                statusText += ' (Your turn)';
            }
        }
    }
    
    elements.gameStatus.textContent = statusText;
    elements.turnIndicator.textContent = gameState.turn === 'w' ? "White's Turn" : "Black's Turn";
    
    // Update player card highlights
    elements.whitePlayerCard.classList.toggle('your-turn', gameState.turn === 'w');
    elements.blackPlayerCard.classList.toggle('your-turn', gameState.turn === 'b');
}

function updateTimers() {
    if (!gameState.timers) return;
    
    elements.whiteTimer.textContent = formatTime(gameState.timers.white);
    elements.blackTimer.textContent = formatTime(gameState.timers.black);
    
    // Add timer styling
    elements.whiteTimer.classList.toggle('timer-active', gameState.turn === 'w' && gameState.gameActive);
    elements.blackTimer.classList.toggle('timer-active', gameState.turn === 'b' && gameState.gameActive);
    
    elements.whiteTimer.classList.toggle('timer-low', gameState.timers.white < 30000);
    elements.blackTimer.classList.toggle('timer-low', gameState.timers.black < 30000);
}

function updateStats() {
    if (gameState.stats) {
        elements.moveCount.textContent = gameState.stats.totalMoves || 0;
    }
}

function addMoveToHistory(move) {
    if (!move) return;
    
    const moveElement = document.createElement('div');
    moveElement.className = 'move-item';
    
    const moveNumber = Math.ceil((gameState.moveHistory.length + 1) / 2);
    const isWhiteMove = (gameState.moveHistory.length % 2 === 0);
    
    if (isWhiteMove) {
        moveElement.textContent = `${moveNumber}. ${move.san}`;
    } else {
        moveElement.textContent = `${moveNumber}...${move.san}`;
    }
    
    elements.moveHistory.appendChild(moveElement);
    elements.moveHistory.scrollTop = elements.moveHistory.scrollHeight;
    
    gameState.moveHistory.push(move);
}

function addChatMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    let content = '';
    if (message.type === 'system' || message.type === 'error') {
        content = `[${message.type.toUpperCase()}] ${message.message}`;
        messageElement.style.fontStyle = 'italic';
        messageElement.style.color = message.type === 'error' ? '#ef4444' : '#10b981';
    } else {
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        content = `[${time}] ${message.playerName || 'System'}: ${message.message}`;
    }
    
    messageElement.textContent = content;
    elements.chatContainer.appendChild(messageElement);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function showGameInterface() {
    hideModal(elements.mainMenu);
    hideModal(elements.queueModal);
    showModal(elements.gameInterface);
    
    if (socket && socket.connected) {
        socket.emit('requestRoomState');
    }
}

function showGameEndModal(data) {
    elements.gameEndTitle.textContent = 'Game Over!';
    
    let message = '';
    if (data.winner === 'draw') {
        message = `Game drawn by ${data.reason}`;
    } else {
        message = `${data.winner} wins by ${data.reason}`;
    }
    
    elements.gameEndMessage.textContent = message;
    
    if (data.stats) {
        elements.gameEndStats.innerHTML = `
            <div>Total moves: ${data.stats.totalMoves}</div>
            <div>Captures: ${data.stats.captures}</div>
            <div>Duration: ${formatDuration(data.duration)}</div>
        `;
    }
    
    showModal(elements.gameEndModal);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Load sound preference
    const savedSoundEnabled = localStorage.getItem('chessGameSoundEnabled');
    if (savedSoundEnabled !== null) {
        soundEnabled = savedSoundEnabled === 'true';
        elements.soundControl.textContent = soundEnabled ? '🔊' : '🔇';
        elements.soundControl.classList.toggle('muted', !soundEnabled);
    }

    // Main menu event listeners
    elements.casualBtn.addEventListener('click', () => {
        const usernameValue = elements.usernameInput.value.trim();
        if (!usernameValue) {
            alert('Please enter a username');
            return;
        }
        username = usernameValue;
        socket.emit('setUsername', { username });
        socket.emit('joinQueue', { gameType: 'casual' });
    });

    elements.rankedBtn.addEventListener('click', () => {
        const usernameValue = elements.usernameInput.value.trim();
        if (!usernameValue) {
            alert('Please enter a username');
            return;
        }
        username = usernameValue;
        socket.emit('setUsername', { username });
        socket.emit('joinQueue', { gameType: 'ranked' });
    });

    elements.createRoomBtn.addEventListener('click', () => {
        const usernameValue = elements.usernameInput.value.trim();
        if (!usernameValue) {
            alert('Please enter a username');
            return;
        }
        username = usernameValue;
        socket.emit('setUsername', { username });
        showModal(elements.timeControlModal);
    });

    elements.joinRoomBtn.addEventListener('click', () => {
        const usernameValue = elements.usernameInput.value.trim();
        if (!usernameValue) {
            alert('Please enter a username');
            return;
        }
        username = usernameValue;
        socket.emit('setUsername', { username });
        showModal(elements.roomCodeModal);
    });

    // Time control modal
    elements.confirmCreateRoomBtn.addEventListener('click', () => {
        const initialTime = parseInt(elements.initialTimeInput.value) || 10;
        const incrementTime = parseInt(elements.incrementTimeInput.value) || 5;
        
        socket.emit('createRoom', {
            timeControl: {
                initial: initialTime * 60, // Convert to seconds
                increment: incrementTime
            },
            isPrivate: true
        });
        
        hideModal(elements.timeControlModal);
    });

    elements.cancelCreateRoomBtn.addEventListener('click', () => {
        hideModal(elements.timeControlModal);
    });

    // Room code modal
    elements.confirmJoinRoomBtn.addEventListener('click', () => {
        const roomCode = elements.roomCodeInput.value.trim().toUpperCase();
        if (!roomCode) {
            alert('Please enter a room code');
            return;
        }
        
        socket.emit('joinRoomByCode', { code: roomCode });
        hideModal(elements.roomCodeModal);
    });

    elements.cancelJoinRoomBtn.addEventListener('click', () => {
        hideModal(elements.roomCodeModal);
        elements.roomCodeInput.value = '';
    });

    // Queue modal
    elements.leaveQueueBtn.addEventListener('click', () => {
        socket.emit('leaveQueue');
    });

    // Game controls
    elements.resignBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to resign?')) {
            socket.emit('resign');
        }
    });

    elements.drawBtn.addEventListener('click', () => {
        socket.emit('offerDraw');
        addChatMessage({
            type: 'system',
            message: 'Draw offer sent',
            timestamp: new Date()
        });
    });

    elements.newGameBtn.addEventListener('click', () => {
        socket.emit('leaveRoom');
    });

    // Draw offer modal
    elements.acceptDrawBtn.addEventListener('click', () => {
        socket.emit('drawResponse', { accept: true });
        hideModal(elements.drawOfferModal);
    });

    elements.declineDrawBtn.addEventListener('click', () => {
        socket.emit('drawResponse', { accept: false });
        hideModal(elements.drawOfferModal);
    });

    // Game end modal
    elements.closeGameEndBtn.addEventListener('click', () => {
        hideModal(elements.gameEndModal);
    });

    // Chat functionality
    elements.sendChatBtn.addEventListener('click', sendChatMessage);
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Sound control
    elements.soundControl.addEventListener('click', toggleSound);

    // Username input enter key
    elements.usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.casualBtn.click();
        }
    });

    // Room code input enter key
    elements.roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.confirmJoinRoomBtn.click();
        }
    });

    // Prevent context menu on pieces
    document.addEventListener('contextmenu', (e) => {
        if (e.target.classList.contains('piece')) {
            e.preventDefault();
        }
    });

    // Handle window beforeunload
    window.addEventListener('beforeunload', () => {
        if (socket && socket.connected) {
            socket.emit('leaveRoom');
            socket.emit('leaveQueue');
        }
    });

    // Handle window resize for responsive board
    window.addEventListener('resize', () => {
        // Trigger a re-render if needed
        if (gameState.board && gameState.board.length > 0) {
            renderBoard(gameState.board);
        }
    });
}

function sendChatMessage() {
    const message = elements.chatInput.value.trim();
    if (message && socket && socket.connected) {
        socket.emit('chatMessage', { message });
        elements.chatInput.value = '';
    }
}

function resetGameState() {
    gameState = {
        board: [],
        turn: 'w',
        playerColor: null,
        playerRole: 'spectator',
        roomId: null,
        roomCode: null,
        gameActive: false,
        timeControl: null,
        timers: { white: null, black: null },
        selectedSquare: null,
        validMoves: [],
        moveHistory: [],
        stats: {},
        players: { white: null, black: null }
    };

    // Clear move history display
    elements.moveHistory.innerHTML = '<div class="text-gray-400 text-center">No moves yet</div>';
    
    // Clear chat
    elements.chatContainer.innerHTML = '';
    
    // Reset stats
    elements.moveCount.textContent = '0';
    elements.gameDuration.textContent = '0:00';
    
    // Reset timers
    elements.whiteTimer.textContent = '10:00';
    elements.blackTimer.textContent = '10:00';
    
    // Reset player names
    elements.whitePlayerName.textContent = 'White Player';
    elements.blackPlayerName.textContent = 'Black Player';
    elements.whiteRating.textContent = '1200';
    elements.blackRating.textContent = '1200';
    
    // Clear board
    if (elements.chessboard) {
        elements.chessboard.innerHTML = '';
    }
    
    // Stop game duration timer
    stopGameDurationTimer();
}

// --- Error Handling ---
function handleError(error) {
    console.error('Chess game error:', error);
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    errorMessage.textContent = error.message || 'An error occurred';
    
    document.body.appendChild(errorMessage);
    
    setTimeout(() => {
        errorMessage.remove();
    }, 5000);
}

// --- Initialization ---
function init() {
    try {
        // Check if all required elements exist
        const requiredElements = [
            'main-menu', 'queue-modal', 'game-interface', 'chessboard',
            'username-input', 'casual-btn', 'ranked-btn'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            return;
        }

        // Initialize socket connection
        initializeSocket();
        
        // Setup event listeners
        setupEventListeners();
        
        // Show main menu
        showModal(elements.mainMenu);
        
        // Focus username input
        elements.usernameInput.focus();
        
        console.log('Enhanced Chess Client initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize chess client:', error);
        handleError(error);
    }
}

// --- Utility Functions for Development ---
function debugGameState() {
    console.log('=== Game State Debug ===');
    console.log('Room ID:', gameState.roomId);
    console.log('Player Color:', gameState.playerColor);
    console.log('Player Role:', gameState.playerRole);
    console.log('Game Active:', gameState.gameActive);
    console.log('Turn:', gameState.turn);
    console.log('Selected Square:', gameState.selectedSquare);
    console.log('Valid Moves:', gameState.validMoves);
    console.log('Move History Length:', gameState.moveHistory.length);
    console.log('========================');
}

function debugRoomInfo() {
    console.log('=== Room Info Debug ===');
    console.log('Room Code:', gameState.roomCode);
    console.log('Players:', gameState.players);
    console.log('Timers:', gameState.timers);
    console.log('Stats:', gameState.stats);
    console.log('Socket Connected:', socket ? socket.connected : false);
    console.log('=======================');
}

// Make debug functions available globally for development
window.chessDebug = {
    gameState: debugGameState,
    roomInfo: debugRoomInfo,
    resetGame: resetGameState,
    playTestSound: (type) => playSound(type)
};

// --- Start the application ---
document.addEventListener('DOMContentLoaded', init);

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, potentially pause timers or reduce activity
        console.log('Page hidden');
    } else {
        // Page is visible, resume normal activity
        console.log('Page visible');
        if (socket && socket.connected && gameState.roomId) {
            socket.emit('requestRoomState');
        }
    };
});

// --- Mobile Support ---
function setupMobileSupport() {
    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    // Handle mobile orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (gameState.board && gameState.board.length > 0) {
                renderBoard(gameState.board);
            }
        }, 100);
    });
}

// Initialize mobile support
setupMobileSupport();

console.log('Enhanced Chess Client script loaded successfully');