const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ---- وضع دراجات الضوء (تنافسي) ----
const GRID_W = 44;
const GRID_H = 28;
const TICK_MS = 110;
const MAX_PLAYERS = 6;

// ---- وضع غزو الجواهر (تعاوني) ----
const COOP_GRID_W = 24;
const COOP_GRID_H = 16;
const COOP_TICK_START = 160;
const COOP_TICK_MIN = 90;
const COOP_TICK_STEP = 8;
const COOP_MAX_PLAYERS = 4;
const COOP_START_LIVES = 5;
const COOP_COIN_COUNT = 4;
const COOP_OBSTACLES_START = 3;
const COOP_OBSTACLES_MAX = 9;
const COOP_LEVEL_STEP = 10;
const COOP_RESPAWN_MS = 1400;

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
const wss = new WebSocketServer({ server, path: '/ws' });

/** @type {Map<string, Room>} */
const rooms = new Map();

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg) {
  for (const p of room.players.values()) send(p.ws, msg);
}

function lobbyPayload(room) {
  return {
    type: 'lobby',
    code: room.code,
    mode: room.mode,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isHost: p.id === room.hostId,
    })),
  };
}

function maxPlayersFor(mode) {
  return mode === 'coop' ? COOP_MAX_PLAYERS : MAX_PLAYERS;
}

function minPlayersFor(mode) {
  return mode === 'coop' ? 1 : 2;
}

// ======================= دراجات الضوء (تنافسي) =======================

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

function startTronGame(room) {
  resetRound(room);
  broadcast(room, {
    type: 'start',
    mode: 'tron',
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
  room.interval = setInterval(() => tickTron(room), TICK_MS);
}

function endTronRound(room, winner) {
  room.status = 'lobby';
  clearInterval(room.interval);
  room.interval = null;
  broadcast(room, {
    type: 'gameover',
    mode: 'tron',
    winner: winner ? { id: winner.id, name: winner.name, color: winner.color } : null,
  });
}

function tickTron(room) {
  const alivePlayers = [...room.players.values()].filter((p) => p.alive);
  const nextHeads = new Map();

  for (const p of alivePlayers) {
    if (p.nextDir && OPPOSITE[p.nextDir] !== p.dir) p.dir = p.nextDir;
    const d = DIRS[p.dir];
    nextHeads.set(p.id, { nx: p.x + d.x, ny: p.y + d.y });
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

  broadcast(room, { type: 'tick', mode: 'tron', players: events });

  const stillAlive = [...room.players.values()].filter((p) => p.alive);
  if (stillAlive.length <= 1) {
    endTronRound(room, stillAlive[0] || null);
  }
}

// ======================= غزو الجواهر (تعاوني) =======================

function coopFreeCell(room, avoid) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = Math.floor(Math.random() * COOP_GRID_W);
    const y = Math.floor(Math.random() * COOP_GRID_H);
    const key = `${x},${y}`;
    if (avoid.has(key)) continue;
    return { x, y };
  }
  return { x: Math.floor(COOP_GRID_W / 2), y: Math.floor(COOP_GRID_H / 2) };
}

function coopOccupied(room) {
  const occ = new Set();
  for (const p of room.players.values()) occ.add(`${p.x},${p.y}`);
  for (const o of room.obstacles) occ.add(`${o.x},${o.y}`);
  for (const c of room.coins) occ.add(`${c.x},${c.y}`);
  return occ;
}

function coopSpawnCoin(room) {
  const cell = coopFreeCell(room, coopOccupied(room));
  room.coins.push(cell);
}

function coopSpawnObstacle(room) {
  const cell = coopFreeCell(room, coopOccupied(room));
  const dirs = [-1, 0, 1];
  let dx = 0, dy = 0;
  while (dx === 0 && dy === 0) {
    dx = dirs[Math.floor(Math.random() * 3)];
    dy = dirs[Math.floor(Math.random() * 3)];
  }
  room.obstacles.push({ x: cell.x, y: cell.y, dx, dy });
}

function coopStartPositions(n) {
  const spots = [
    { x: 2, y: 2 },
    { x: COOP_GRID_W - 3, y: 2 },
    { x: 2, y: COOP_GRID_H - 3 },
    { x: COOP_GRID_W - 3, y: COOP_GRID_H - 3 },
  ];
  return spots.slice(0, n);
}

function coopResetRound(room) {
  const ids = [...room.players.keys()];
  const positions = coopStartPositions(ids.length);
  ids.forEach((id, i) => {
    const p = room.players.get(id);
    p.x = positions[i].x;
    p.y = positions[i].y;
    p.dir = 'right';
    p.nextDir = 'right';
    p.down = false;
    p.downTicks = 0;
  });
  room.coins = [];
  room.obstacles = [];
  room.score = 0;
  room.level = 1;
  room.lives = COOP_START_LIVES;
  room.tickMs = COOP_TICK_START;
  for (let i = 0; i < COOP_COIN_COUNT; i++) coopSpawnCoin(room);
  for (let i = 0; i < COOP_OBSTACLES_START; i++) coopSpawnObstacle(room);
  room.status = 'playing';
}

function startCoopGame(room) {
  coopResetRound(room);
  broadcast(room, {
    type: 'start',
    mode: 'coop',
    grid: { w: COOP_GRID_W, h: COOP_GRID_H },
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      x: p.x,
      y: p.y,
      dir: p.dir,
    })),
    coins: room.coins,
    obstacles: room.obstacles,
    score: room.score,
    lives: room.lives,
    level: room.level,
    tickMs: room.tickMs,
  });
  coopScheduleTick(room);
}

function coopScheduleTick(room) {
  if (room.interval) clearInterval(room.interval);
  room.interval = setInterval(() => tickCoop(room), room.tickMs);
}

function endCoopRound(room) {
  room.status = 'lobby';
  clearInterval(room.interval);
  room.interval = null;
  broadcast(room, { type: 'gameover', mode: 'coop', score: room.score, level: room.level });
}

function tickCoop(room) {
  // تحريك الكويكبات وارتدادها عن الجدران
  for (const o of room.obstacles) {
    let nx = o.x + o.dx;
    let ny = o.y + o.dy;
    if (nx < 0 || nx >= COOP_GRID_W) { o.dx *= -1; nx = o.x + o.dx; }
    if (ny < 0 || ny >= COOP_GRID_H) { o.dy *= -1; ny = o.y + o.dy; }
    o.x = Math.max(0, Math.min(COOP_GRID_W - 1, nx));
    o.y = Math.max(0, Math.min(COOP_GRID_H - 1, ny));
  }
  const obstacleCells = new Set(room.obstacles.map((o) => `${o.x},${o.y}`));

  const events = [];
  let leveledUp = false;

  for (const p of room.players.values()) {
    if (p.down) {
      p.downTicks--;
      if (p.downTicks <= 0) {
        const cell = coopFreeCell(room, coopOccupied(room));
        p.x = cell.x;
        p.y = cell.y;
        p.down = false;
      }
      events.push({ id: p.id, x: p.x, y: p.y, down: p.down, dir: p.dir });
      continue;
    }

    if (p.nextDir) p.dir = p.nextDir;
    const d = DIRS[p.dir];
    const nx = p.x + d.x;
    const ny = p.y + d.y;
    const outOfBounds = nx < 0 || nx >= COOP_GRID_W || ny < 0 || ny >= COOP_GRID_H;
    const hitObstacle = !outOfBounds && obstacleCells.has(`${nx},${ny}`);

    if (outOfBounds || hitObstacle) {
      room.lives--;
      p.down = true;
      p.downTicks = Math.max(1, Math.round(COOP_RESPAWN_MS / room.tickMs));
      events.push({ id: p.id, x: p.x, y: p.y, down: true, dir: p.dir });
      continue;
    }

    p.x = nx;
    p.y = ny;

    const coinIdx = room.coins.findIndex((c) => c.x === p.x && c.y === p.y);
    if (coinIdx !== -1) {
      room.coins.splice(coinIdx, 1);
      room.score++;
      coopSpawnCoin(room);
      const newLevel = 1 + Math.floor(room.score / COOP_LEVEL_STEP);
      if (newLevel > room.level) {
        room.level = newLevel;
        room.tickMs = Math.max(COOP_TICK_MIN, COOP_TICK_START - (room.level - 1) * COOP_TICK_STEP);
        if (room.obstacles.length < COOP_OBSTACLES_MAX) coopSpawnObstacle(room);
        leveledUp = true;
      }
    }

    events.push({ id: p.id, x: p.x, y: p.y, down: false, dir: p.dir });
  }

  broadcast(room, {
    type: 'tick',
    mode: 'coop',
    players: events,
    coins: room.coins,
    obstacles: room.obstacles,
    score: room.score,
    lives: room.lives,
    level: room.level,
    tickMs: room.tickMs,
  });

  if (room.lives <= 0) {
    endCoopRound(room);
    return;
  }
  if (leveledUp) {
    broadcast(room, { type: 'levelup', level: room.level, score: room.score });
    coopScheduleTick(room);
  }
}

// ======================= اتصال WebSocket المشترك =======================

function startGame(room) {
  if (room.players.size < minPlayersFor(room.mode)) return;
  if (room.mode === 'coop') startCoopGame(room);
  else startTronGame(room);
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
    if (room.mode === 'tron') {
      const stillAlive = [...room.players.values()].filter((pl) => pl.alive);
      if (stillAlive.length <= 1) endTronRound(room, stillAlive[0] || null);
    } else if (room.players.size === 0) {
      endCoopRound(room);
    }
  }

  broadcast(room, lobbyPayload(room));
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const action = url.searchParams.get('action');
  const code = (url.searchParams.get('code') || '').trim();
  const name = (url.searchParams.get('name') || 'لاعب').slice(0, 12);
  const modeParam = url.searchParams.get('mode') === 'coop' ? 'coop' : 'tron';

  if (!/^[0-9]{4}$/.test(code) || (action !== 'create' && action !== 'join')) {
    send(ws, { type: 'error', code: 'BAD_REQUEST', message: 'طلب غير صالح' });
    ws.close();
    return;
  }

  if (action === 'create') {
    if (rooms.has(code)) {
      send(ws, { type: 'error', code: 'CODE_TAKEN', message: 'الرمز مستخدم بالفعل' });
      ws.close();
      return;
    }
    const room = {
      code,
      mode: modeParam,
      hostId: null,
      players: new Map(),
      status: 'lobby',
      interval: null,
      trailSet: new Set(),
      coins: [],
      obstacles: [],
      score: 0,
      level: 1,
      lives: 0,
      tickMs: COOP_TICK_START,
    };
    rooms.set(code, room);

    const playerId = Math.random().toString(36).slice(2, 10);
    const color = COLORS[0];
    room.players.set(playerId, { id: playerId, name, color, ws, alive: true, down: false });
    room.hostId = playerId;
    ws.roomCode = code;
    ws.playerId = playerId;

    send(ws, { type: 'created', code, playerId, color, mode: room.mode });
    broadcast(room, lobbyPayload(room));
  } else {
    const room = rooms.get(code);
    if (!room) {
      send(ws, { type: 'error', code: 'NOT_FOUND', message: 'الغرفة غير موجودة' });
      ws.close();
      return;
    }
    if (room.status === 'playing') {
      send(ws, { type: 'error', code: 'IN_PROGRESS', message: 'اللعبة بدأت بالفعل، انتظر الجولة القادمة' });
      ws.close();
      return;
    }
    if (room.players.size >= maxPlayersFor(room.mode)) {
      send(ws, { type: 'error', code: 'FULL', message: 'الغرفة ممتلئة' });
      ws.close();
      return;
    }

    const playerId = Math.random().toString(36).slice(2, 10);
    const usedColors = new Set([...room.players.values()].map((p) => p.color));
    const color = COLORS.find((c) => !usedColors.has(c)) || COLORS[room.players.size % COLORS.length];
    room.players.set(playerId, { id: playerId, name, color, ws, alive: true, down: false });
    ws.roomCode = code;
    ws.playerId = playerId;

    send(ws, { type: 'joined', code, playerId, color, mode: room.mode });
    broadcast(room, lobbyPayload(room));
  }

  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    if (msg.type === 'start' && room.hostId === ws.playerId) {
      startGame(room);
    }
    if (msg.type === 'restart' && room.hostId === ws.playerId) {
      startGame(room);
    }
    if (msg.type === 'dir' && room.status === 'playing' && DIRS[msg.dir]) {
      const p = room.players.get(ws.playerId);
      if (!p) return;
      if (room.mode === 'tron') {
        if (p.alive) p.nextDir = msg.dir;
      } else if (!p.down) {
        p.nextDir = msg.dir;
      }
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
