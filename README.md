# Real-Time Chess Game

![Chess Game Preview]![image](https://github.com/user-attachments/assets/76075553-d1f8-4fd6-8305-b8d453d8b2f5)


## Introduction

Welcome to my real-time chess game built with Node.js, Express, Socket.io, and Chess.js! This project allows two players to engage in a chess match over a local server, with real-time interaction and instant updates across both players' interfaces. Whether you're a chess enthusiast or a web developer looking for inspiration, this project showcases the seamless integration of various web technologies to create an interactive and engaging experience.

## Features

- **Real-Time Gameplay:** Instant move validation and updates across both players' windows.
- **Dynamic Scoring System:** Automatically updates the score based on captured pieces.
- **Responsive Design:** A clean and intuitive user interface, optimized for various screen sizes.
- **Automatic Role Assignment:** Players are assigned as White or Black upon joining, with additional users spectating.
- **Robust Game Logic:** Supports all standard chess rules, including checkmate, stalemate, and draws.

![Game Roles]![image](https://github.com/user-attachments/assets/6c00cd5a-333f-442d-8e06-aceb985cba2e)


## Tech Stack

- **Backend:**
  - **Node.js:** For server-side logic and routing.
  - **Express:** Simplifies the creation of web applications.
  - **Socket.io:** Enables real-time, bidirectional communication between the server and clients.
  - **Chess.js:** Manages the game logic, including move validation and game state tracking.

- **Frontend:**
  - **HTML & CSS:** Structures and styles the webpage, with Tailwind CSS providing a modern and responsive design.
  - **JavaScript:** Handles drag-and-drop functionality, score updates, and server communication.

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v14 or above)
- **npm** (v6 or above)

### Installation

1. Clone the repository:
   
   git clone https://github.com/anshulkotwal/chess-game.git
   
2. Navigate to the project directory :
   cd chess-game

3. Install the dependencies:
   npm install

Running the Game
1. Start the server:
   npm start
   
2. Open your browser and navigate to:
   http://localhost:3000

3. Open a second window or use another device to simulate the second player.

Gameplay
Drag and drop the pieces to make a move. The system will automatically validate the move, update the board, and adjust the score accordingly. The game supports all standard chess rules, including special moves like castling and en passant.


Challenges & Learnings
This project provided valuable insights into real-time web applications, especially in handling synchronous events between multiple clients. Ensuring that game states were accurately maintained and reflected across different clients was a rewarding challenge.

Future Enhancements
Chat System: Allow players to communicate during the game.
AI Opponent: Implement an AI to play against when no second player is available.
Move History: Track and display previous moves for better game analysis.
Enhanced UI/UX: Add animations, sound effects, and additional visual feedback for a more immersive experience.
Contributing
Contributions are welcome! If you'd like to improve this project, feel free to fork the repository and submit a pull request.

License
This project is licensed under the MIT License - see the LICENSE file for details.

Acknowledgments
Special thanks to the creators of Node.js, Express, Socket.io, and Chess.js for providing the tools to make this project possible.

