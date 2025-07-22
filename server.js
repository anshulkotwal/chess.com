const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js'); // Import chess.js
const cors = require('cors'); // This import is for Express if you use app.use(cors)

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'https://chess-com-delta.vercel.app',
        methods: ['GET', 'POST']
    }
});

app.use(cors({
    origin: 'https://chess-com-delta.vercel.app',
    methods: ['GET', 'POST']
}));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Game State Variables
const games = {}; // Stores game instances, keyed by gameId
const players = {}; // Stores player information (socketId -> { username, role, gameId })
const waitingPlayers = []; // Sockets waiting for a match
const playerSockets = {}; // { gameId: { white: socket.id, black: socket.id } }
const gameTimers = {}; // Stores setInterval IDs for game timers
let spectatorCount = 0;
const gameStartTime = {}; // Define this variable here, as it's used before the listen call

// Utility function to generate a unique game ID (simple for now)
function generateGameId() {
    return Math.random().toString(36).substring(2, 9);
}

// Function to calculate material score
function calculateMaterialScore(board) {
    const pieceValues = {
        'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0 // King value not used for material
    };
    let whiteScore = 0;
    let blackScore = 0;

    board.forEach(row => {
        row.forEach(square => {
            if (square) {
                const pieceType = square.type;
                const pieceColor = square.color;
                if (pieceColor === 'w') {
                    whiteScore += pieceValues[pieceType];
                } else {
                    blackScore += pieceValues[pieceType];
                }
            }
        });
    });
    return { white: whiteScore, black: blackScore };
}

// Function to reset a game
function resetGame(gameId) {
    if (games[gameId]) {
        console.log(`Resetting game ${gameId}`);
        if (gameTimers[gameId]) {
            clearInterval(gameTimers[gameId]);
            delete gameTimers[gameId];
        }

        const whitePlayerId = playerSockets[gameId] ? playerSockets[gameId].white : null;
        const blackPlayerId = playerSockets[gameId] ? playerSockets[gameId].black : null;

        // Clean up player roles and notify clients
        if (whitePlayerId && players[whitePlayerId]) {
            players[whitePlayerId].role = 'spectator';
            // Only emit if the socket is still connected
            if (io.sockets.sockets.get(whitePlayerId)) {
                io.to(whitePlayerId).emit('playerRole', { role: 'spectator' });
            }
        }
        if (blackPlayerId && players[blackPlayerId]) {
            players[blackPlayerId].role = 'spectator';
            // Only emit if the socket is still connected
            if (io.sockets.sockets.get(blackPlayerId)) {
                io.to(blackPlayerId).emit('playerRole', { role: 'spectator' });
            }
        }

        // Emit game reset to all clients in the room
        io.to(gameId).emit('gameReset');

        // Remove from waitingPlayers if they somehow got back in there during reset
        [whitePlayerId, blackPlayerId].forEach(pId => {
            const index = waitingPlayers.findIndex(s => s.id === pId);
            if (index !== -1) {
                waitingPlayers.splice(index, 1);
            }
        });


        // Delete game instances and player mappings
        delete games[gameId];
        delete playerSockets[gameId];

        // Disconnect players from game room to prevent lingering state if they were players
        if (whitePlayerId) {
            const whiteSocket = io.sockets.sockets.get(whitePlayerId);
            if (whiteSocket) whiteSocket.leave(gameId);
        }
        if (blackPlayerId) {
            const blackSocket = io.sockets.sockets.get(blackPlayerId);
            if (blackSocket) blackSocket.leave(gameId);
        }

        console.log(`Game ${gameId} has been reset and cleaned up.`);
    }
}


// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    players[socket.id] = { username: `Guest-${socket.id.substring(0, 4)}`, role: 'spectator', gameId: null };
    spectatorCount++;
    io.emit('spectatorCount', spectatorCount); // Update all clients about spectator count

    // Inform the new client about their initial role
    socket.emit('playerRole', { role: 'spectator' });

    // Request initial state for a potentially reconnecting player
    // This is useful if a player refreshes their page but a game is still active
    socket.on('requestInitialState', () => {
        const playerInfo = players[socket.id];
        if (playerInfo && playerInfo.gameId && games[playerInfo.gameId]) {
            const gameId = playerInfo.gameId;
            const game = games[gameId];
            const boardState = game.board();
            const turn = game.turn();
            const moveCount = game.history().length;
            const scores = calculateMaterialScore(boardState);
            // Filter captured pieces from the full history for scoreboard display
            const capturedWhite = game.history({ verbose: true }).filter(m => m.captured && m.color === 'b').map(m => m.captured);
            const capturedBlack = game.history({ verbose: true }).filter(m => m.captured && m.color === 'w').map(m => m.captured);
            const isCheck = game.inCheck(); // This one is correctly `inCheck()`

            // Re-join the game room if not already in it
            if (!socket.rooms.has(gameId)) {
                socket.join(gameId);
            }

            socket.emit('requestBoardStateResponse', {
                board: boardState,
                turn: turn,
                whiteScore: scores.white,
                blackScore: scores.black,
                moveCount: moveCount,
                history: game.history({ verbose: true }),
                capturedWhite: capturedWhite,
                capturedBlack: capturedBlack,
                isCheck: isCheck
            });
            socket.emit('playerRole', { role: playerInfo.role, gameId: playerInfo.gameId });
            socket.emit('hideWaitingOverlay'); // Hide waiting overlay on reconnection
            console.log(`Player ${socket.id} reconnected to game ${gameId}`);

            // Re-emit latest game time for reconnected player
            if (gameTimers[gameId]) {
                const elapsedSeconds = (Date.now() - gameStartTime[gameId]) / 1000;
                socket.emit('gameTimeUpdate', Math.floor(elapsedSeconds));
            }

        } else {
            // If not in a game, ensure waiting overlay is shown
            // Check if player is already waiting
            if (!waitingPlayers.find(s => s.id === socket.id)) {
                waitingPlayers.push(socket);
            }
            socket.emit('waitingForPlayer', { message: "Waiting for another player to join..." });
        }
    });


    // Try to find or create a game for the connecting client
    // This logic runs AFTER 'requestInitialState' has a chance to re-link
    // If client is still waiting, put them in queue
    if (!players[socket.id].gameId && !waitingPlayers.find(s => s.id === socket.id)) {
        if (waitingPlayers.length > 0) {
            const player1Socket = waitingPlayers.shift(); // Get the first waiting player

            // Ensure the retrieved socket is still connected
            if (!player1Socket || player1Socket.disconnected) {
                console.log(`Previous waiting player ${player1Socket ? player1Socket.id : 'N/A'} disconnected, adding current player ${socket.id} to waiting list.`);
                waitingPlayers.push(socket);
                socket.emit('waitingForPlayer', { message: "Waiting for another player to join..." });
                return;
            }

            const gameId = generateGameId();
            games[gameId] = new Chess();

            playerSockets[gameId] = {
                white: player1Socket.id,
                black: socket.id
            };

            // Assign roles and gameId
            players[player1Socket.id].role = 'white';
            players[player1Socket.id].gameId = gameId;
            players[socket.id].role = 'black';
            players[socket.id].gameId = gameId;

            // Make both players join the game room
            player1Socket.join(gameId);
            socket.join(gameId);

            // Notify players about their roles and the board state
            player1Socket.emit('playerRole', { role: 'white', gameId });
            socket.emit('playerRole', { role: 'black', gameId });

            // Send initial game state to both players
            const boardState = games[gameId].board();
            const turn = games[gameId].turn();
            const moveCount = games[gameId].history().length;
            const initialScore = calculateMaterialScore(boardState);

            io.to(gameId).emit('gameStart', {
                board: boardState,
                turn,
                whiteScore: initialScore.white,
                blackScore: initialScore.black,
                moveCount: moveCount,
                whitePlayerId: player1Socket.id,
                blackPlayerId: socket.id
            });

            console.log(`Game ${gameId} started between ${player1Socket.id} (White) and ${socket.id} (Black)`);

            // Start game timer
            gameStartTime[gameId] = Date.now(); // Store start time for more accurate time updates
            gameTimers[gameId] = setInterval(() => {
                const elapsedSeconds = Math.floor((Date.now() - gameStartTime[gameId]) / 1000);
                io.to(gameId).emit('gameTimeUpdate', elapsedSeconds);
            }, 1000);

        } else {
            waitingPlayers.push(socket);
            socket.emit('waitingForPlayer', { message: "Waiting for another player to join..." });
            console.log(`Player ${socket.id} is waiting for a match.`);
        }
    }


    // Handle incoming chess moves
    socket.on('move', (move) => {
        const playerInfo = players[socket.id];
        if (!playerInfo || !playerInfo.gameId) {
            socket.emit('invalidMove', { message: 'You are not in an active game.' });
            return;
        }

        const gameId = playerInfo.gameId;
        const game = games[gameId];
        if (!game) {
            socket.emit('invalidMove', { message: 'Game not found.' });
            return;
        }

        const currentPlayerColor = game.turn(); // 'w' or 'b'
        const playerRoleColor = playerInfo.role === 'white' ? 'w' : 'b';

        // Check if it's the player's turn
        if (currentPlayerColor !== playerRoleColor) {
            socket.emit('invalidMove', { message: 'It is not your turn.' });
            return;
        }

        try {
            // The chess.js move function can take an object with from, to, and promotion
            const result = game.move({
                from: move.from,
                to: move.to,
                promotion: move.promotion // promotion is optional, will be 'q' by default if pawn reaches end rank
            });

            if (result) {
                const boardState = game.board();
                const turn = game.turn();
                const moveCount = game.history().length;
                const scores = calculateMaterialScore(boardState);
                const isCheck = game.inCheck();
                const capturedPiece = result.captured; // 'p', 'n', 'b', 'r', 'q'

                // Filter captured pieces from the full history for scoreboard display
                const capturedWhite = game.history({ verbose: true }).filter(m => m.captured && m.color === 'b').map(m => m.captured);
                const capturedBlack = game.history({ verbose: true }).filter(m => m.captured && m.color === 'w').map(m => m.captured);


                // Emit updated board state to all players in the game room
                io.to(gameId).emit('boardUpdate', {
                    board: boardState,
                    turn: turn,
                    lastMove: { from: move.from, to: move.to },
                    moveCount: moveCount,
                    whiteScore: scores.white,
                    blackScore: scores.black,
                    capturedPiece: capturedPiece,
                    isCheck: isCheck,
                    history: game.history({ verbose: true }), // Send verbose history for display
                    capturedWhite: capturedWhite, // Send these for client to update scoreboard
                    capturedBlack: capturedBlack
                });

                // Check for game over conditions
                // *** CORRECTION START ***
                if (game.isCheckmate()) { // Changed from game.inCheckmate()
                    const winnerColor = game.turn() === 'w' ? 'Black' : 'White';
                    io.to(gameId).emit('gameOver', { winner: winnerColor, reason: 'Checkmate' });
                    console.log(`Game ${gameId} ended: ${winnerColor} wins by Checkmate`);
                    resetGame(gameId);
                } else if (game.isDraw()) { // Changed from game.inDraw() for consistency, although this one might have worked
                    io.to(gameId).emit('gameOver', { winner: 'Draw', reason: 'Draw' });
                    console.log(`Game ${gameId} ended: Draw`);
                    resetGame(gameId);
                } else if (game.isStalemate()) { // Changed from game.inStalemate()
                    io.to(gameId).emit('gameOver', { winner: 'Draw', reason: 'Stalemate' });
                    console.log(`Game ${gameId} ended: Stalemate`);
                    resetGame(gameId);
                } else if (game.isThreefoldRepetition()) { // Changed from game.inThreefoldRepetition() for consistency
                    io.to(gameId).emit('gameOver', { winner: 'Draw', reason: 'Threefold Repetition' });
                    console.log(`Game ${gameId} ended: Threefold Repetition`);
                    resetGame(gameId);
                } else if (game.isInsufficientMaterial()) { // Changed from game.insufficientMaterial() for consistency
                    io.to(gameId).emit('gameOver', { winner: 'Draw', reason: 'Insufficient Material' });
                    console.log(`Game ${gameId} ended: Insufficient Material`);
                    resetGame(gameId);
                }
                // *** CORRECTION END ***
            } else {
                socket.emit('invalidMove', { message: 'Invalid move.' });
            }
        } catch (error) {
            console.error(`Error processing move for ${socket.id}:`, error.message);
            socket.emit('invalidMove', { message: 'An error occurred during the move: ' + error.message });
        }
    });

    // Handle requests for valid moves for a selected piece
    socket.on('requestValidMoves', ({ from }) => {
        const playerInfo = players[socket.id];
        if (!playerInfo || !playerInfo.gameId) {
            return; // Not in a game
        }
        const game = games[playerInfo.gameId];
        if (game) {
            const moves = game.moves({ square: from, verbose: true });
            socket.emit('requestValidMovesResponse', { moves });
        }
    });

    // Handle new game requests
    socket.on('newGameRequest', () => { // Changed from 'newGame' to 'newGameRequest' for clarity
        const playerInfo = players[socket.id];
        if (playerInfo.gameId) {
            // Player is already in a game, leave it first and reset
            resetGame(playerInfo.gameId);
            console.log(`Player ${socket.id} left game ${playerInfo.gameId} for a new one.`);
        }

        // Put the player in the waiting list for a new game
        playerInfo.gameId = null; // Clear previous game ID
        playerInfo.role = 'spectator'; // Reset role temporarily
        // Ensure not already in waitingPlayers before pushing
        if (!waitingPlayers.find(s => s.id === socket.id)) {
            waitingPlayers.push(socket);
        }
        socket.emit('waitingForPlayer', { message: "Waiting for another player to join for a new game..." });
        socket.emit('playerRole', { role: 'spectator' }); // Inform client about temp role
        console.log(`Player ${socket.id} requested a new game and is now waiting.`);
    });


    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const playerInfo = players[socket.id];

        if (playerInfo) {
            spectatorCount--;
            io.emit('spectatorCount', spectatorCount); // Update all clients

            // If the disconnected user was a waiting player, remove them
            const waitingIndex = waitingPlayers.findIndex(s => s.id === socket.id);
            if (waitingIndex !== -1) {
                waitingPlayers.splice(waitingIndex, 1);
                console.log(`Removed disconnected player ${socket.id} from waiting list.`);
            }

            // If the disconnected user was part of a game
            if (playerInfo.gameId) {
                const gameId = playerInfo.gameId;
                if (playerSockets[gameId]) {
                    const opponentSocketId = (playerSockets[gameId].white === socket.id) ? playerSockets[gameId].black : playerSockets[gameId].white;

                    // Notify opponent that their partner disconnected
                    if (opponentSocketId) {
                        io.to(opponentSocketId).emit('playerDisconnected', { message: 'Your opponent has disconnected. Game ended.' });
                    }
                    console.log(`Player ${socket.id} disconnected from game ${gameId}. Ending game.`);
                    resetGame(gameId); // Reset and clean up the game
                }
            }
            delete players[socket.id];
        }
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});