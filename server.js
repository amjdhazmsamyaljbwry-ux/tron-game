const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const GRID_W = 44;
const GRID_H = 28;
const TICK_MS = 110;
const MAX_PLAYERS = 6;

const COLORS = ['#ff5252', '#40c4ff', '#69f0ae', '#ffd740', '#e040fb', '#ff6e40'];
const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** @type {Map<string, Room>} */
const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId) {
  for (const p of room.players.values()) {
    if (p.id === exceptId) continue;
    send(p.ws, msg);
  }
}

function lobbyPayload(room) {
  return {
    type: 'lobby',
    code: room.code,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isHost: p.id === room.hostId,
    })),
  };
}

function startPositions(n) {
  const cx = GRID_W / 2;
  const cy = GRID_H / 2;
  const radius = Math.min(GRID_W, GRID_H) / 2 - 3;
  const positions = [];
  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    const x = Math.round(cx + radius * Math.cos(angle));
    const y = Math.round(cy + radius * Math.sin(angle));
    const dx = cx - x;
    const dy = cy - y;
    let dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
    else dir = dy > 0 ? 'down' : 'up';
    positions.push({ x, y, dir });
  }
  return positions;
}

function resetRound(room) {
  const ids = [...room.players.keys()];
  const positions = startPositions(ids.length);
  room.trailSet = new Set();
  ids.forEach((id, i) => {
    const p = room.players.get(id);
    p.x = positions[i].x;
    p.y = positions[i].y;
    p.dir = positions[i].dir;
    p.nextDir = positions[i].dir;
    p.alive = true;
    room.trailSet.add(`${p.x},${p.y}`);
  });
  room.status = 'playing';
}

function startGame(room) {
  if (room.players.size < 2) return;
  resetRound(room);
  broadcast(room, {
    type: 'start',
    grid: { w: GRID_W, h: GRID_H },
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      x: p.x,
      y: p.y,
      dir: p.dir,
    })),
  });
  if (room.interval) clearInterval(room.interval);
  room.interval = setInterval(() => tick(room), TICK_MS);
}

function endRound(room, winner) {
  room.status = 'lobby';
  clearInterval(room.interval);
  room.interval = null;
  broadcast(room, {
    type: 'gameover',
    winner: winner ? { id: winner.id, name: winner.name, color: winner.color } : null,
  });
}

function tick(room) {
  const alivePlayers = [...room.players.values()].filter((p) => p.alive);
  const nextHeads = new Map();

  for (const p of alivePlayers) {
    if (p.nextDir && OPPOSITE[p.nextDir] !== p.dir) p.dir = p.nextDir;
    const d = DIRS[p.dir];
    const nx = p.x + d.x;
    const ny = p.y + d.y;
    nextHeads.set(p.id, { nx, ny });
  }

  const headCellCounts = new Map();
  for (const { nx, ny } of nextHeads.values()) {
    const key = `${nx},${ny}`;
    headCellCounts.set(key, (headCellCounts.get(key) || 0) + 1);
  }

  const events = [];
  for (const p of alivePlayers) {
    const { nx, ny } = nextHeads.get(p.id);
    const key = `${nx},${ny}`;
    let dead = false;
    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) dead = true;
    else if (room.trailSet.has(key)) dead = true;
    else if (headCellCounts.get(key) > 1) dead = true;

    if (dead) {
      p.alive = false;
      events.push({ id: p.id, x: p.x, y: p.y, alive: false, trailCell: null });
    } else {
      room.trailSet.add(`${p.x},${p.y}`);
      const trailCell = { x: p.x, y: p.y };
      p.x = nx;
      p.y = ny;
      events.push({ id: p.id, x: p.x, y: p.y, alive: true, trailCell });
    }
  }

  broadcast(room, { type: 'tick', players: events });

  const stillAlive = [...room.players.values()].filter((p) => p.alive);
  if (stillAlive.length <= 1) {
    endRound(room, stillAlive[0] || null);
  }
}

function removePlayer(ws) {
  const { roomCode, playerId } = ws;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  if (!room) return;
  room.players.delete(playerId);

  if (room.players.size === 0) {
    if (room.interval) clearInterval(room.interval);
    rooms.delete(roomCode);
    return;
  }

  if (room.hostId === playerId) {
    room.hostId = [...room.players.keys()][0];
  }

  if (room.status === 'playing') {
    const p = room.players.get(playerId);
    const stillAlive = [...room.players.values()].filter((pl) => pl.alive);
    if (stillAlive.length <= 1) {
      endRound(room, stillAlive[0] || null);
    }
  }

  broadcast(room, lobbyPayload(room));
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'create') {
      const code = makeCode();
      const room = {
        code,
        hostId: null,
        players: new Map(),
        status: 'lobby',
        interval: null,
        trailSet: new Set(),
      };
      rooms.set(code, room);

      const playerId = Math.random().toString(36).slice(2, 10);
      const color = COLORS[0];
      room.players.set(playerId, { id: playerId, name: msg.name || 'لاعب', color, ws, alive: true });
      room.hostId = playerId;
      ws.roomCode = code;
      ws.playerId = playerId;

      send(ws, { type: 'created', code, playerId, color });
      broadcast(room, lobbyPayload(room));
    }

    if (msg.type === 'join') {
      const code = (msg.code || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: 'error', message: 'الغرفة غير موجودة' });
        return;
      }
      if (room.players.size >= MAX_PLAYERS) {
        send(ws, { type: 'error', message: 'الغرفة ممتلئة' });
        return;
      }
      if (room.status === 'playing') {
        send(ws, { type: 'error', message: 'اللعبة بدأت بالفعل، انتظر الجولة القادمة' });
        return;
      }

      const playerId = Math.random().toString(36).slice(2, 10);
      const usedColors = new Set([...room.players.values()].map((p) => p.color));
      const color = COLORS.find((c) => !usedColors.has(c)) || COLORS[room.players.size % COLORS.length];
      room.players.set(playerId, { id: playerId, name: msg.name || 'لاعب', color, ws, alive: true });
      ws.roomCode = code;
      ws.playerId = playerId;

      send(ws, { type: 'joined', code, playerId, color });
      broadcast(room, lobbyPayload(room));
    }

    if (msg.type === 'start') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.playerId) return;
      startGame(room);
    }

    if (msg.type === 'dir') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.status !== 'playing') return;
      const p = room.players.get(ws.playerId);
      if (!p || !p.alive) return;
      if (DIRS[msg.dir]) p.nextDir = msg.dir;
    }

    if (msg.type === 'restart') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.playerId) return;
      startGame(room);
    }
  });

  ws.on('close', () => removePlayer(ws));
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
});
