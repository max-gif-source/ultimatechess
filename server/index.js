const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const path = require("path");
const { randomUUID } = require("crypto");
const { spawn } = require("child_process");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, version: "2.0.0", engineConfigured: Boolean(process.env.STOCKFISH_PATH) });
});

// Engine analysis is server-side. Install Stockfish and set STOCKFISH_PATH to enable it.
app.post("/api/analyze", async (req, res) => {
  const { fen, depth = 14 } = req.body || {};
  if (typeof fen !== "string" || fen.length > 200) return res.status(400).json({ error: "A valid FEN is required." });
  const stockfishPath = process.env.STOCKFISH_PATH;
  if (!stockfishPath) return res.status(503).json({ error: "Stockfish is not configured. Install Stockfish and set STOCKFISH_PATH; see README." });

  let child;
  try {
    const result = await new Promise((resolve, reject) => {
      child = spawn(stockfishPath, [], { stdio: ["pipe", "pipe", "ignore"] });
      let output = "";
      let finished = false;
      const timeout = setTimeout(() => { if (!finished) { finished = true; child.kill(); reject(new Error("Stockfish timed out.")); } }, 20000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/bestmove\s+(\S+)(?:\s+ ponder\s+(\S+))?/);
        if (match && !finished) {
          finished = true; clearTimeout(timeout);
          const infos = output.split(/\r?\n/).filter(line => line.startsWith("info ") && line.includes(" score "));
          const lastInfo = infos[infos.length - 1] || "";
          const cp = lastInfo.match(/\bscore cp (-?\d+)/);
          const mate = lastInfo.match(/\bscore mate (-?\d+)/);
          resolve({ bestmove: match[1], ponder: match[2] || null, scoreCp: cp ? Number(cp[1]) : null, mate: mate ? Number(mate[1]) : null, depth: Number((lastInfo.match(/\bdepth (\d+)/) || [])[1] || depth) });
          child.kill();
        }
      });
      child.on("error", err => { if (!finished) { finished = true; clearTimeout(timeout); reject(err); } });
      child.stdin.write("uci\nisready\nposition fen " + fen + "\ngo depth " + Math.max(8, Math.min(20, Number(depth) || 14)) + "\n");
    });
    res.json(result);
  } catch (err) {
    if (child && !child.killed) child.kill();
    res.status(500).json({ error: err.message || "Engine analysis failed." });
  }
});

function roomSnapshot(room) {
  return {
    code: room.code,
    fen: room.game.fen(),
    pgn: room.game.pgn(),
    turn: room.game.turn(),
    players: [...room.players.values()].map(p => ({ name: p.name, color: p.color })),
    status: room.game.isGameOver() ? (room.game.isCheckmate() ? "checkmate" : "draw") : "playing"
  };
}
function emitRoom(room) { io.to(room.code).emit("room:update", roomSnapshot(room)); }
function cleanName(value) { return String(value || "Guest").trim().replace(/[<>]/g, "").slice(0, 18) || "Guest"; }
function makeCode() { return Math.random().toString(36).slice(2, 7).toUpperCase(); }

io.on("connection", socket => {
  socket.on("room:create", ({ name } = {}, ack = () => {}) => {
    let code; do { code = makeCode(); } while (rooms.has(code));
    const room = { code, game: new Chess(), players: new Map(), createdAt: Date.now() };
    room.players.set(socket.id, { name: cleanName(name), color: "w" });
    rooms.set(code, room); socket.join(code); socket.data.room = code;
    ack({ ok: true, room: roomSnapshot(room), color: "w" });
  });

  socket.on("room:join", ({ code, name } = {}, ack = () => {}) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: "Room not found. Check the code." });
    if (room.players.size >= 2) return ack({ ok: false, error: "This room already has two players." });
    if (room.game.history().length) return ack({ ok: false, error: "This game has already started." });
    const color = "b";
    room.players.set(socket.id, { name: cleanName(name), color });
    socket.join(code); socket.data.room = code;
    ack({ ok: true, room: roomSnapshot(room), color });
    emitRoom(room);
  });

  socket.on("game:move", ({ from, to, promotion } = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    if (!room) return ack({ ok: false, error: "You are not in a game room." });
    const player = room.players.get(socket.id);
    if (!player || player.color !== room.game.turn()) return ack({ ok: false, error: "It is not your turn." });
    try {
      const move = room.game.move({ from, to, promotion: promotion || "q" });
      emitRoom(room);
      ack({ ok: true, san: move.san });
    } catch {
      ack({ ok: false, error: "That move is not legal." });
    }
  });

  socket.on("game:resign", (_data, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    if (!room) return ack?.({ ok: false });
    const player = room.players.get(socket.id);
    if (!player) return ack?.({ ok: false });
    room.resigned = player.color;
    io.to(room.code).emit("room:message", `${player.name} resigned.`);
    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    room.players.delete(socket.id);
    if (!room.players.size) rooms.delete(code);
    else {
      io.to(code).emit("room:message", `${player?.name || "A player"} disconnected. The room will remain open briefly.`);
      emitRoom(room);
      setTimeout(() => { const current = rooms.get(code); if (current && current.players.size === 1 && Date.now() - current.createdAt > 30 * 60 * 1000) rooms.delete(code); }, 30 * 60 * 1000);
    }
  });
});

server.listen(PORT, () => console.log(`ULTIMATECHESS is running at http://localhost:${PORT}`));
