const socket = io();
const chess = new Chess();
const boardelement = document.querySelector(".chessboard");
const whiteScoreElement = document.querySelector("#white-score");
const blackScoreElement = document.querySelector("#black-score");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let whiteScore = 0;
let blackScore = 0;

const pieceValues = {
    'p': 1,
    'r': 5,
    'n': 3,
    'b': 3,
    'q': 9,
    'k': 0
};

const renderBoard = () => {
    const board = chess.board();
    boardelement.innerHTML = "";
    board.forEach((row, rowindex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square",
                (rowindex + squareindex) % 2 == 0 ? "light" : "dark"
            );
            squareElement.dataset.row = rowindex;
            squareElement.dataset.col = squareindex;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });
                pieceElement.addEventListener("dragend", (e) => {
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
};

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: "q"
    };

    const targetPiece = chess.get(`${String.fromCharCode(97 + target.col)}${8 - target.row}`);
    const validMove = chess.move(move);

    if (validMove) {
        socket.emit("move", move); // Emit the move event with move data

        if (targetPiece) {
            updateScore(targetPiece);
        }

        const result = checkGameState();
        if (result) {
            socket.emit("gameOver", result);
        }
    }
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
    if (capturedPiece.color === 'w') {
        blackScore += pieceValue;
    } else {
        whiteScore += pieceValue;
    }
    whiteScoreElement.innerText = `White: ${whiteScore}`;
    blackScoreElement.innerText = `Black: ${blackScore}`;
};

const checkGameState = () => {
    if (chess.in_checkmate()) {
        return chess.turn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
    }
    if (chess.in_draw()) {
        return 'The game is a draw!';
    }
    if (chess.in_stalemate()) {
        return 'The game is a stalemate!';
    }
    if (chess.in_threefold_repetition()) {
        return 'The game is a draw by threefold repetition!';
    }
    if (chess.insufficient_material()) {
        return 'The game is a draw due to insufficient material!';
    }
    return null;
};

const showMessage = (message) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.innerText = message;
    document.body.appendChild(messageElement);
};

socket.on("playerRole", function (role) {
    playerRole = role;
    renderBoard();
});

socket.on("spectatorRole", function () {
    playerRole = null;
    renderBoard();
});

socket.on("boardState", function (fen) {
    chess.load(fen);
    renderBoard();
});

socket.on("move", function (move) {
    const targetPiece = chess.get(move.to);
    chess.move(move);
    renderBoard();

    if (targetPiece) {
        updateScore(targetPiece);
    }

    const result = checkGameState();
    if (result) {
        showMessage(result);
    }
});

socket.on("gameOver", function (result) {
    showMessage(result);
});

renderBoard();
