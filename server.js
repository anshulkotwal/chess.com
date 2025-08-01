require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? [process.env.CLIENT_URL || "https://chess-com-452r.onrender.com"]
            : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.CLIENT_URL || "https://chess-com-452r.onrender.com"]
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Enhanced data structures
const rooms = new Map(); // roomId -> Room object
const players = new Map(); // socketId -> Player object
const matchmaking = {
    casual: [], // Players waiting for casual games
    ranked: [], // Players waiting for ranked games
    custom: new Map() // roomCode -> room waiting for players
};

// Room class for better organization
class GameRoom {
    constructor(roomId, type = 'casual', timeControl = null, isPrivate = false) {
        this.id = roomId;
        this.type = type;
        this.timeControl = timeControl || { initial: 600, increment: 5 }; // Default 10 min + 5 sec
        this.isPrivate = isPrivate;
        this.code = isPrivate ? this.generateRoomCode() : null;
        this.game = new Chess();
        this.players = { white: null, black: null };
        this.spectators = new Set();
        this.status = 'waiting';
        this.createdAt = new Date();
        this.startedAt = null;
        this.endedAt = null;
        this.winner = null;
        this.endReason = null;
        this.moveHistory = [];
        this.chat = [];
        this.maxSpectators = 100;

        // Timer management
        this.timers = {
            white: this.timeControl.initial * 1000,
            black: this.timeControl.initial * 1000,
            lastMoveTime: null,
            activeTimer: null,
            activeColor: null
        };

        // Game statistics
        this.stats = {
            totalMoves: 0,
            captures: 0,
            checks: 0,
            castles: 0,
            promotions: 0
        };

        // Sound tracking
        this.lastSoundPlayed = null;
    }

    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    addPlayer(socket, color = null) {
        if (this.players.white && this.players.black) {
            return this.addSpectator(socket);
        }

        const player = players.get(socket.id);
        if (!player) return false;

        // Assign color
        if (!color) {
            if (!this.players.white) color = 'white';
            else if (!this.players.black) color = 'black';
            else return this.addSpectator(socket);
        }

        if (this.players[color]) {
            return this.addSpectator(socket);
        }

        this.players[color] = socket.id;
        player.room = this.id;
        player.role = color;
        socket.join(this.id);

        console.log(`Player ${player.username} joined room ${this.id} as ${color}`);

        // Emit room joined event
        socket.emit('roomJoined', { 
            roomId: this.id, 
            role: color,
            roomCode: this.code 
        });

        // Start game if both players present
        if (this.players.white && this.players.black && this.status === 'waiting') {
            setTimeout(() => this.startGame(), 1000); // Small delay to ensure clients are ready
        }

        return true;
    }

    addSpectator(socket) {
        if (this.spectators.size >= this.maxSpectators) return false;
        
        const player = players.get(socket.id);
        if (!player) return false;

        this.spectators.add(socket.id);
        player.room = this.id;
        player.role = 'spectator';
        socket.join(this.id);
        
        console.log(`Player ${player.username} joined room ${this.id} as spectator`);
        
        socket.emit('roomJoined', { 
            roomId: this.id, 
            role: 'spectator',
            roomCode: this.code 
        });
        
        return true;
    }

    removePlayer(socketId) {
        const player = players.get(socketId);
        if (!player) return;

        console.log(`Player ${player.username} leaving room ${this.id}`);

        if (this.players.white === socketId) {
            this.players.white = null;
        } else if (this.players.black === socketId) {
            this.players.black = null;
        } else {
            this.spectators.delete(socketId);
        }

        player.room = null;
        player.role = 'spectator';

        // End game if a player disconnects during active game
        if (this.status === 'active' && (this.players.white === null || this.players.black === null)) {
            const winner = this.players.white ? 'white' : (this.players.black ? 'black' : null);
            this.endGame('disconnect', winner);
        }

        // Notify remaining players
        this.broadcastRoomState();
    }

    startGame() {
        if (this.status !== 'waiting' || !this.players.white || !this.players.black) {
            return;
        }

        this.status = 'active';
        this.startedAt = new Date();
        
        // Initialize timers
        this.timers.lastMoveTime = Date.now();
        this.timers.activeColor = 'white';
        this.startTimer('white');

        console.log(`Game started in room ${this.id}`);

        // Get player data safely
        const whitePlayer = players.get(this.players.white);
        const blackPlayer = players.get(this.players.black);

        // Notify all players in room
        const gameStartData = {
            board: this.game.board(),
            turn: this.game.turn(),
            players: {
                white: whitePlayer ? whitePlayer.username : 'Unknown',
                black: blackPlayer ? blackPlayer.username : 'Unknown'
            },
            ratings: {
                white: whitePlayer ? whitePlayer.rating : 1200,
                black: blackPlayer ? blackPlayer.rating : 1200
            },
            timeControl: this.timeControl,
            timers: {
                white: this.timers.white,
                black: this.timers.black
            },
            roomCode: this.code,
            stats: { ...this.stats }
        };

        io.to(this.id).emit('gameStart', gameStartData);
        
        // Play game start sound
        this.playSound('gameStartSound');
    }

    makeMove(socketId, move) {
        if (this.status !== 'active') {
            return { success: false, error: 'Game not active' };
        }
        
        const player = players.get(socketId);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }
        
        const currentTurn = this.game.turn();
        const playerColor = player.role;
        
        // Check if it's the player's turn
        if ((currentTurn === 'w' && playerColor !== 'white') || 
            (currentTurn === 'b' && playerColor !== 'black')) {
            return { success: false, error: 'Not your turn' };
        }

        // Check time
        if (this.isTimeUp(playerColor)) {
            this.endGame('timeout', playerColor === 'white' ? 'black' : 'white');
            return { success: false, error: 'Time up' };
        }

        try {
            // Store position before move for sound detection
            const beforeMove = {
                inCheck: this.game.inCheck(),
                pieces: this.game.board().flat().filter(p => p !== null).length
            };

            const result = this.game.move({
                from: move.from,
                to: move.to,
                promotion: move.promotion || 'q'
            });

            if (!result) {
                return { success: false, error: 'Invalid move' };
            }

            console.log(`Move made in room ${this.id}: ${result.san} by ${player.username}`);

            // Update timers
            this.updateTimer(playerColor);
            const nextColor = currentTurn === 'w' ? 'black' : 'white';
            this.startTimer(nextColor);

            // Update statistics
            this.updateStats(result);
            
            const moveData = {
                san: result.san,
                from: result.from,
                to: result.to,
                piece: result.piece,
                captured: result.captured,
                promotion: result.promotion,
                timestamp: new Date(),
                timeUsed: Date.now() - this.timers.lastMoveTime,
                player: player.username
            };
            
            this.moveHistory.push(moveData);

            // Determine and play appropriate sound
            this.determineMoveSound(result, beforeMove);
            
            // Check for game end
            this.checkGameEnd();

            // Broadcast move update
            const updateData = {
                move: {
                    san: result.san,
                    from: result.from,
                    to: result.to,
                    piece: result.piece,
                    captured: result.captured,
                    promotion: result.promotion
                },
                board: this.game.board(),
                turn: this.game.turn(),
                timers: {
                    white: this.timers.white,
                    black: this.timers.black
                },
                stats: { ...this.stats },
                gameStatus: this.getGameStatus()
            };

            io.to(this.id).emit('moveUpdate', updateData);

            return { success: true, move: result };

        } catch (error) {
            console.error('Move error in room', this.id, ':', error);
            return { success: false, error: error.message };
        }
    }

    determineMoveSound(move, beforeMove) {
        let soundType = 'moveSound';
        
        // Priority order: checkmate > check > capture > castle > promotion > move
        if (this.game.isCheckmate()) {
            soundType = 'gameOverSound';
        } else if (this.game.inCheck()) {
            soundType = 'checkSound';
        } else if (move.captured) {
            soundType = 'captureSound';
        } else if (move.san.includes('O-O')) {
            soundType = 'castleSound';
        } else if (move.promotion) {
            soundType = 'promoteSound';
        }
        
        this.playSound(soundType);
    }

    playSound(soundType) {
        this.lastSoundPlayed = soundType;
        io.to(this.id).emit('playSound', { type: soundType });
    }

    updateTimer(color) {
        if (!this.timers.lastMoveTime) return;
        
        const now = Date.now();
        const timeUsed = now - this.timers.lastMoveTime;
        this.timers[color] = Math.max(0, this.timers[color] - timeUsed);
        
        // Add increment (but not on first move)
        if (this.stats.totalMoves > 0 && this.timeControl.increment) {
            this.timers[color] += this.timeControl.increment * 1000;
        }
        
        this.timers.lastMoveTime = now;
    }

    startTimer(color) {
        // Clear existing timer
        if (this.timers.activeTimer) {
            clearInterval(this.timers.activeTimer);
        }
        
        this.timers.activeColor = color;
        this.timers.lastMoveTime = Date.now();
        
        this.timers.activeTimer = setInterval(() => {
            if (this.status !== 'active') {
                clearInterval(this.timers.activeTimer);
                return;
            }
            
            this.timers[color] = Math.max(0, this.timers[color] - 1000);
            
            // Emit timer update
            io.to(this.id).emit('timerUpdate', {
                timers: {
                    white: this.timers.white,
                    black: this.timers.black
                },
                activeColor: color
            });
            
            // Check for timeout
            if (this.timers[color] <= 0) {
                this.endGame('timeout', color === 'white' ? 'black' : 'white');
            }
        }, 1000);
    }

    isTimeUp(color) {
        return this.timers[color] <= 0;
    }

    updateStats(move) {
        this.stats.totalMoves++;
        if (move.captured) this.stats.captures++;
        if (move.san.includes('+')) this.stats.checks++;
        if (move.san.includes('O-O')) this.stats.castles++;
        if (move.promotion) this.stats.promotions++;
    }

    checkGameEnd() {
        if (this.game.isGameOver()) {
            let winner = null;
            let reason = '';

            if (this.game.isCheckmate()) {
                winner = this.game.turn() === 'w' ? 'black' : 'white';
                reason = 'checkmate';
            } else if (this.game.isDraw()) {
                winner = 'draw';
                if (this.game.isStalemate()) reason = 'stalemate';
                else if (this.game.isThreefoldRepetition()) reason = 'repetition';
                else if (this.game.isInsufficientMaterial()) reason = 'insufficient material';
                else reason = 'draw';
            }

            this.endGame(reason, winner);
        }
    }

    endGame(reason, winner) {
        if (this.status === 'finished') return; // Prevent multiple endings
        
        this.status = 'finished';
        this.endedAt = new Date();
        this.winner = winner;
        this.endReason = reason;
        
        // Clear timers
        if (this.timers.activeTimer) {
            clearInterval(this.timers.activeTimer);
            this.timers.activeTimer = null;
        }

        console.log(`Game ended in room ${this.id}: ${winner} wins by ${reason}`);

        // Update player stats
        this.updatePlayerStats(winner, reason);

        // Calculate game duration
        const duration = this.endedAt - this.startedAt;

        // Emit game end
        const gameEndData = {
            winner,
            reason,
            stats: { ...this.stats },
            duration,
            finalPosition: this.game.fen(),
            moveHistory: this.moveHistory.slice(-10) // Last 10 moves
        };

        io.to(this.id).emit('gameEnd', gameEndData);

        // Play appropriate end game sound
        if (winner === 'draw') {
            this.playSound('gameOverSound');
        } else {
            this.playSound('gameOverSound');
        }

        // Schedule cleanup
        setTimeout(() => {
            this.cleanup();
        }, 300000); // 5 minutes
    }

    updatePlayerStats(winner, reason) {
        const whitePlayer = players.get(this.players.white);
        const blackPlayer = players.get(this.players.black);

        if (whitePlayer) {
            whitePlayer.gamesPlayed++;
            if (winner === 'white') whitePlayer.wins++;
            else if (winner === 'black') whitePlayer.losses++;
            else whitePlayer.draws++;
        }

        if (blackPlayer) {
            blackPlayer.gamesPlayed++;
            if (winner === 'black') blackPlayer.wins++;
            else if (winner === 'white') blackPlayer.losses++;
            else blackPlayer.draws++;
        }
    }

    addChatMessage(socketId, message) {
        const player = players.get(socketId);
        if (!player) return;

        const chatMessage = {
            id: crypto.randomUUID(),
            playerId: socketId,
            playerName: player.username,
            message: message.trim().substring(0, 200), // Limit message length
            timestamp: new Date(),
            type: 'chat'
        };

        this.chat.push(chatMessage);
        
        // Keep only last 100 messages
        if (this.chat.length > 100) {
            this.chat = this.chat.slice(-100);
        }

        io.to(this.id).emit('chatMessage', chatMessage);
    }

    getValidMoves(square) {
        try {
            const moves = this.game.moves({ square, verbose: true });
            return moves.map(move => move.to);
        } catch (error) {
            console.error('Error getting valid moves:', error);
            return [];
        }
    }

    getGameStatus() {
        if (this.status === 'waiting') return 'Waiting for players';
        if (this.status === 'finished') return `Game over: ${this.winner} by ${this.endReason}`;
        
        const turn = this.game.turn() === 'w' ? 'White' : 'Black';
        let status = `${turn} to move`;
        
        if (this.game.inCheck()) status += ' (in check)';
        
        return status;
    }

    broadcastRoomState() {
        const whitePlayer = players.get(this.players.white);
        const blackPlayer = players.get(this.players.black);
        
        const roomState = {
            board: this.game.board(),
            turn: this.game.turn(),
            timers: {
                white: this.timers.white,
                black: this.timers.black
            },
            stats: { ...this.stats },
            players: {
                white: whitePlayer ? whitePlayer.username : null,
                black: blackPlayer ? blackPlayer.username : null
            },
            spectators: this.spectators.size,
            chat: this.chat.slice(-20), // Last 20 messages
            gameActive: this.status === 'active',
            gameStatus: this.getGameStatus(),
            roomCode: this.code
        };

        io.to(this.id).emit('roomState', roomState);
    }

    cleanup() {
        console.log(`Cleaning up room ${this.id}`);
        
        // Clear timers
        if (this.timers.activeTimer) {
            clearInterval(this.timers.activeTimer);
        }

        // Remove all players from room
        [...Object.values(this.players), ...this.spectators].forEach(socketId => {
            if (socketId) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.leave(this.id);
                }
                const player = players.get(socketId);
                if (player) {
                    player.room = null;
                    player.role = 'spectator';
                }
            }
        });

        // Remove from matchmaking if exists
        matchmaking.custom.delete(this.code);
        rooms.delete(this.id);
    }
}

// Player class
class Player {
    constructor(socketId, username) {
        this.id = socketId;
        this.username = username;
        this.room = null;
        this.role = 'spectator';
        this.rating = 1200;
        this.gamesPlayed = 0;
        this.wins = 0;
        this.losses = 0;
        this.draws = 0;
        this.connectedAt = new Date();
    }

    getStats() {
        return {
            rating: this.rating,
            gamesPlayed: this.gamesPlayed,
            wins: this.wins,
            losses: this.losses,
            draws: this.draws,
            winRate: this.gamesPlayed > 0 ? (this.wins / this.gamesPlayed * 100).toFixed(1) : 0
        };
    }
}

// Utility functions
function generateRoomId() {
    return crypto.randomUUID();
}

function findMatch(player, gameType) {
    const queue = matchmaking[gameType];
    if (!queue || queue.length === 0) return null;

    // Simple matchmaking - just take the first player
    return queue.shift();
}

// API Endpoints
app.get('/', (req, res) => {
    res.send(`
        <h1>Enhanced Chess Server</h1>
        <p>Server is running!</p>
        <p>Active rooms: ${rooms.size}</p>
        <p>Active players: ${players.size}</p>
        <p>Queue status:</p>
        <ul>
            <li>Casual: ${matchmaking.casual.length} players</li>
            <li>Ranked: ${matchmaking.ranked.length} players</li>
            <li>Custom: ${matchmaking.custom.size} rooms</li>
        </ul>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        activeRooms: rooms.size,
        activePlayers: players.size,
        matchmaking: {
            casual: matchmaking.casual.length,
            ranked: matchmaking.ranked.length,
            custom: matchmaking.custom.size
        },
        memory: process.memoryUsage(),
        uptime: process.uptime()
    });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Initialize player
    const player = new Player(socket.id, `Guest-${socket.id.substring(0, 4)}`);
    players.set(socket.id, player);

    socket.emit('connected', {
        playerId: socket.id,
        serverTime: new Date().toISOString()
    });

    // Set username
    socket.on('setUsername', ({ username }) => {
        if (username && typeof username === 'string' && username.trim().length > 0) {
            const cleanUsername = username.trim().substring(0, 20);
            player.username = cleanUsername;
            console.log(`Username set for ${socket.id}: ${player.username}`);
            socket.emit('usernameSet', { username: player.username });
        }
    });

    // Join matchmaking queue
    socket.on('joinQueue', ({ gameType, timeControl }) => {
        if (player.room) {
            socket.emit('error', { message: 'Already in a game' });
            return;
        }

        const validTypes = ['casual', 'ranked'];
        if (!validTypes.includes(gameType)) {
            socket.emit('error', { message: 'Invalid game type' });
            return;
        }

        console.log(`${player.username} joining ${gameType} queue`);

        // Remove from other queues first
        Object.values(matchmaking).forEach(queue => {
            if (Array.isArray(queue)) {
                const index = queue.findIndex(p => p.id === socket.id);
                if (index !== -1) queue.splice(index, 1);
            }
        });

        // Try to find a match
        const opponent = findMatch(player, gameType);
        
        if (opponent) {
            console.log(`Match found: ${player.username} vs ${opponent.username}`);
            
            // Create game room
            const roomId = generateRoomId();
            const defaultTimeControl = { initial: 600, increment: 5 }; // 10 min + 5 sec
            const room = new GameRoom(roomId, gameType, timeControl || defaultTimeControl);
            rooms.set(roomId, room);

            // Add both players
            room.addPlayer(socket, 'white');
            const opponentSocket = io.sockets.sockets.get(opponent.id);
            if (opponentSocket) {
                room.addPlayer(opponentSocket, 'black');
            }

            socket.emit('matchFound', { roomId, color: 'white' });
            if (opponentSocket) {
                opponentSocket.emit('matchFound', { roomId, color: 'black' });
            }
        } else {
            // Add to queue
            matchmaking[gameType].push(player);
            socket.emit('queueJoined', { 
                gameType, 
                position: matchmaking[gameType].length 
            });
        }
    });

    // Create custom room
    socket.on('createRoom', ({ timeControl, isPrivate = true }) => {
        if (player.room) {
            socket.emit('error', { message: 'Already in a game' });
            return;
        }

        console.log(`${player.username} creating ${isPrivate ? 'private' : 'public'} room`);

        const roomId = generateRoomId();
        const defaultTimeControl = { initial: 600, increment: 5 };
        const room = new GameRoom(roomId, 'custom', timeControl || defaultTimeControl, isPrivate);
        rooms.set(roomId, room);
        
        if (room.addPlayer(socket, 'white')) {
            socket.emit('roomCreated', { 
                roomId: room.id, 
                roomCode: room.code,
                isPrivate: room.isPrivate
            });
        } else {
            socket.emit('error', { message: 'Failed to create room' });
        }
    });

    // Join room by code
    socket.on('joinRoomByCode', ({ code }) => {
        if (player.room) {
            socket.emit('error', { message: 'Already in a game' });
            return;
        }

        console.log(`${player.username} trying to join room with code: ${code}`);
        
        const room = Array.from(rooms.values()).find(r => r.code === code);
        
        if (!room) {
            socket.emit('error', { message: 'Room not found. Please check the room code.' });
            return;
        }

        if (room.status === 'finished') {
            socket.emit('error', { message: 'This game has already ended.' });
            return;
        }

        if (room.addPlayer(socket)) {
            console.log(`${player.username} successfully joined room ${room.id}`);
        } else {
            socket.emit('error', { message: 'Unable to join room. It may be full.' });
        }
    });

    // Make move
    socket.on('makeMove', (move) => {
        const room = rooms.get(player.room);
        if (!room) {
            socket.emit('moveError', { error: 'Not in a game room' });
            return;
        }

        const result = room.makeMove(socket.id, move);
        if (!result.success) {
            socket.emit('moveError', { error: result.error });
        }
    });

    // Get valid moves
    socket.on('getValidMoves', ({ from }) => {
        const room = rooms.get(player.room);
        if (!room || room.status !== 'active') return;

        const moves = room.getValidMoves(from);
        socket.emit('validMoves', { moves, from });
    });

    // Send chat message
    socket.on('chatMessage', ({ message }) => {
        const room = rooms.get(player.room);
        if (!room) return;

        if (typeof message === 'string' && message.trim().length > 0) {
            room.addChatMessage(socket.id, message);
        }
    });

    // Resign game
    socket.on('resign', () => {
        const room = rooms.get(player.room);
        if (!room || room.status !== 'active') {
            socket.emit('error', { message: 'Cannot resign - no active game' });
            return;
        }

        const winner = player.role === 'white' ? 'black' : 'white';
        room.endGame('resignation', winner);
    });

    // Offer draw
    socket.on('offerDraw', () => {
        const room = rooms.get(player.room);
        if (!room || room.status !== 'active') {
            socket.emit('error', { message: 'Cannot offer draw - no active game' });
            return;
        }

        const opponentId = player.role === 'white' ? room.players.black : room.players.white;
        if (opponentId) {
            const opponentSocket = io.sockets.sockets.get(opponentId);
            if (opponentSocket) {
                opponentSocket.emit('drawOffer', { from: player.username });
            }
        }
    });

    // Accept/decline draw
    socket.on('drawResponse', ({ accept }) => {
        const room = rooms.get(player.room);
        if (!room || room.status !== 'active') return;

        if (accept) {
            room.endGame('agreement', 'draw');
        } else {
            const opponentId = player.role === 'white' ? room.players.black : room.players.white;
            if (opponentId) {
                const opponentSocket = io.sockets.sockets.get(opponentId);
                if (opponentSocket) {
                    opponentSocket.emit('drawDeclined', { from: player.username });
                }
            }
        }
    });

    // Leave queue
    socket.on('leaveQueue', () => {
        let removed = false;
        Object.values(matchmaking).forEach(queue => {
            if (Array.isArray(queue)) {
                const index = queue.findIndex(p => p.id === socket.id);
                if (index !== -1) {
                    queue.splice(index, 1);
                    removed = true;
                }
            }
        });
        
        if (removed) {
            socket.emit('queueLeft');
            console.log(`${player.username} left matchmaking queue`);
        }
    });

    // Leave room
    socket.on('leaveRoom', () => {
        const room = rooms.get(player.room);
        if (room) {
            room.removePlayer(socket.id);
            socket.leave(room.id);
            socket.emit('roomLeft');
            console.log(`${player.username} left room ${room.id}`);
        }
    });

    // Request room state
    socket.on('requestRoomState', () => {
        const room = rooms.get(player.room);
        if (room) {
            const whitePlayer = players.get(room.players.white);
            const blackPlayer = players.get(room.players.black);
            
            socket.emit('roomState', {
                board: room.game.board(),
                turn: room.game.turn(),
                timers: {
                    white: room.timers.white,
                    black: room.timers.black
                },
                stats: { ...room.stats },
                players: {
                    white: whitePlayer ? whitePlayer.username : null,
                    black: blackPlayer ? blackPlayer.username : null
                },
                spectators: room.spectators.size,
                chat: room.chat.slice(-20),
                gameActive: room.status === 'active'
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        // Remove from queues
        Object.values(matchmaking).forEach(queue => {
            if (Array.isArray(queue)) {
                const index = queue.findIndex(p => p.id === socket.id);
                if (index !== -1) queue.splice(index, 1);
            }
        });

        // Remove from room
        const room = rooms.get(player.room);
        if (room) {
            room.removePlayer(socket.id);
        }

        players.delete(socket.id);
    });
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

// Cleanup inactive rooms periodically
setInterval(() => {
    const now = Date.now();
    const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

    rooms.forEach((room) => {
        if (room.status === 'waiting' && (now - room.createdAt.getTime()) > maxInactiveTime) {
            console.log(`Cleaning up inactive room: ${room.id}`);
            room.cleanup();
        }
    });
}, 5 * 60 * 1000); // Check every 5 minutes

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Enhanced Chess Server listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('Features: Game Rooms, Matchmaking, Time Controls, Chat, Spectating');
});