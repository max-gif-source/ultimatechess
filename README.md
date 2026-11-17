# ULTIMATECHESS 2.0

An original, Chess.com-inspired chess platform. It uses its own name, visual identity and interface; it is not a copy of Chess.com.

## Included in this version

- **Play vs computer:** legal chess moves, castling, en passant, promotion, check/checkmate/draw detection, move history, PGN copy, undo and restart. The built-in bot is lightweight, not a grandmaster engine.
- **Local two-player:** two people can play on the same device.
- **Online private rooms (beta):** create a room, share the short code, and let one other person join. The server validates whose turn it is and validates legal moves. This is a simple room-based multiplayer prototype, not a matchmaking service.
- **Puzzles:** a mate-in-one exercise with a hint.
- **Opening trainer:** an interactive Italian Game line.
- **Learning pages:** short lessons on piece movement, opening principles, checkmate and endgames.
- **PGN analysis interface:** sends each position to Stockfish and lists engine best-move suggestions and evaluations.
- **Local profile counters:** basic activity is stored in browser localStorage.

## Requirements

- Node.js 18 or newer
- Internet connection for the browser-loaded chess.js library, Socket.IO client and fonts
- Stockfish executable for full engine analysis

## Start locally

1. Extract the ZIP.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Optional but recommended: install Stockfish and set `STOCKFISH_PATH` to the executable.
5. Start the server:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000`.

## Enable full Stockfish analysis

Install a Stockfish executable appropriate for your operating system.

- Linux (Debian/Ubuntu): `sudo apt install stockfish`
- macOS: install Stockfish using your preferred package manager or the official Stockfish distribution.
- Windows: download a Stockfish build from the official Stockfish website and note the full path to its `.exe`.

Then set the environment variable before starting the server.

Linux/macOS example:

```bash
STOCKFISH_PATH=/usr/games/stockfish npm start
```

Windows PowerShell example:

```powershell
$env:STOCKFISH_PATH="C:\stockfish\stockfish-windows-x86-64-avx2.exe"
npm start
```

The server runs Stockfish in UCI mode. The analysis endpoint accepts a FEN and a search depth (clamped to 8–20). The review page analyzes every position in the pasted PGN. This can take time, especially for longer games.

## Online multiplayer notes

The online beta uses Socket.IO rooms and keeps games in server memory. Both players need to access the same deployed server. If you deploy it publicly:
- use HTTPS;
- configure rate limits and abuse protection;
- add persistent storage if games must survive server restarts;
- add accounts/authentication before attaching player identities or ratings;
- use a production process manager and hosting provider that supports WebSockets.

## Current limitations

- No user registration, password login, cloud profile or cross-device rating yet.
- No public matchmaking, tournaments, friends list or chat yet.
- The built-in bot is intentionally simple.
- Full engine analysis is available only after Stockfish is installed and `STOCKFISH_PATH` is configured.
- The analysis UI provides engine suggestions and evaluations; it does not yet implement Chess.com-style accuracy percentages or polished natural-language explanations.
- Puzzles and opening lessons are starter content and can be expanded.

## Project structure

```text
ultimatechess-v2/
├── package.json
├── .env.example
├── README.md
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── server/
    └── index.js
```
