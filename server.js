const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ---- وضع دراجات الضوء (تنافسي) ----
const GRID_W = 60;
const GRID_H = 38;
const TICK_MS = 110;
const MAX_PLAYERS = 6;
const SHRINK_START_TICKS = Math.round(8000 / TICK_MS);
const SHRINK_INTERVAL_TICKS = Math.round(3000 / TICK_MS);
const TRON_POWERUP_COUNT = 2;

// ---- وضع غزو الجواهر (تعاوني) ----
const COOP_GRID_W = 34;
const COOP_GRID_H = 22;
const COOP_TICK_START = 160;
const COOP_TICK_MIN = 90;
const COOP_TICK_STEP = 8;
const COOP_MAX_PLAYERS = 4;
const COOP_START_LIVES = 5;
const COOP_COIN_COUNT = 4;
const COOP_OBSTACLES_START = 3;
const COOP_OBSTACLES_MAX = 10;
const COOP_LEVEL_STEP = 10;
const COOP_RESPAWN_MS = 1400;
const COOP_DRONE_MAX = 3;
const COOP_SHIELD_SPAWN_CHANCE = 0.01;

// ---- وضع القطط المربوطة (تعاوني - منصات) ----
const CATS_TICK_MS = 33;
const CATS_GRAVITY = 1;
const CATS_JUMP_V = -16;
const CATS_MOVE_SPEED = 5;
const CATS_MAX_FALL = 18;
const CATS_MAX_PLAYERS = 4;
const CAT_W = 30;
const CAT_H = 30;
const ROPE_LENGTH = 120;
const CATS_COYOTE_TICKS = 6;
const CATS_JUMP_BUFFER_TICKS = 6;
const CATS_WORLD_W = 9700;
const CATS_WORLD_H = 760;
const CATS_BOUNCE_V = -25;
const CATS_ICE_ACCEL = 0.15;
const CATS_CRUMBLE_DELAY = 20;
const CATS_CRUMBLE_RESPAWN = 90;
const CATS_PULL_RANGE = 150;
const CATS_PULL_SUCCESS_TICKS = 40;
const CATS_DRAG_IN_TICKS = 55;
const CATS_COMBO_WINDOW_TICKS = 45;
const CATS_IMPACT_VY = 14;

// المرحلة 0: البداية (تمهيدية)
const CATS_PLATFORMS_BASE = [
  { x: 0, y: 560, w: 260, h: 200 },
  { x: 360, y: 560, w: 200, h: 200 },
  { x: 650, y: 480, w: 150, h: 200 },
  { x: 920, y: 560, w: 260, h: 200 },
  { x: 1270, y: 490, w: 120, h: 26 },
  { x: 1480, y: 420, w: 120, h: 26 },
  { x: 1720, y: 560, w: 260, h: 200 },
  { x: 2040, y: 500, w: 150, h: 26 },
  { x: 2290, y: 560, w: 270, h: 200 },
  // المرحلة 1: المنصات المتأرجحة
  { x: 2650, y: 520, w: 110, h: 26, type: 'moving', axis: 'x', range: 80, speed: 0.05, phase: 0 },
  { x: 2950, y: 470, w: 110, h: 26, type: 'moving', axis: 'y', range: 90, speed: 0.04, phase: 1.5 },
  { x: 3200, y: 520, w: 110, h: 26, type: 'moving', axis: 'x', range: 70, speed: 0.06, phase: 3 },
  { x: 3400, y: 560, w: 200, h: 200 },
  // المرحلة 2: الجسر المنهار
  { x: 3650, y: 520, w: 90, h: 26, type: 'crumble' },
  { x: 3780, y: 520, w: 90, h: 26, type: 'crumble' },
  { x: 3910, y: 520, w: 90, h: 26, type: 'crumble' },
  { x: 4040, y: 520, w: 90, h: 26, type: 'crumble' },
  { x: 4170, y: 520, w: 90, h: 26, type: 'crumble' },
  { x: 4250, y: 560, w: 200, h: 200 },
  // المرحلة 3: أبراج القفز المرن
  { x: 4450, y: 560, w: 100, h: 200 },
  { x: 4600, y: 545, w: 70, h: 20, type: 'bounce' },
  { x: 4700, y: 430, w: 70, h: 20, type: 'bounce' },
  { x: 4850, y: 340, w: 90, h: 26 },
  { x: 5000, y: 430, w: 70, h: 20, type: 'bounce' },
  { x: 5150, y: 545, w: 70, h: 20, type: 'bounce' },
  { x: 5250, y: 560, w: 200, h: 200 },
  // المرحلة 4: وادي الرياح
  { x: 5450, y: 560, w: 100, h: 200 },
  { x: 5480, y: 520, w: 110, h: 26 },
  { x: 5680, y: 520, w: 110, h: 26 },
  { x: 5880, y: 520, w: 110, h: 26 },
  { x: 6080, y: 520, w: 110, h: 26 },
  { x: 6150, y: 560, w: 100, h: 200 },
  // المرحلة 5: الجليد الزلق
  { x: 6250, y: 560, w: 220, h: 200, type: 'ice' },
  { x: 6560, y: 560, w: 220, h: 200, type: 'ice' },
  { x: 6870, y: 560, w: 230, h: 200, type: 'ice' },
  { x: 7100, y: 560, w: 80, h: 200 },
  // المرحلة 6: حفر الإنقاذ
  { x: 7180, y: 560, w: 320, h: 200 },
  { x: 7480, y: 700, w: 190, h: 60, type: 'pitfloor', exitX: 7500, exitY: 490 },
  { x: 7650, y: 560, w: 300, h: 200 },
  { x: 7930, y: 700, w: 220, h: 60, type: 'pitfloor', exitX: 7960, exitY: 490 },
  { x: 8130, y: 560, w: 250, h: 200 },
  // المرحلة 7: السباق الأخير
  { x: 8380, y: 560, w: 100, h: 200 },
  { x: 8520, y: 520, w: 100, h: 26, type: 'moving', axis: 'x', range: 60, speed: 0.07, phase: 0 },
  { x: 8700, y: 545, w: 70, h: 20, type: 'bounce' },
  { x: 8800, y: 420, w: 110, h: 26 },
  { x: 8980, y: 560, w: 200, h: 200, type: 'ice' },
  { x: 9200, y: 470, w: 100, h: 26, type: 'moving', axis: 'y', range: 70, speed: 0.05, phase: 2 },
  { x: 9330, y: 560, w: 270, h: 200 },
];
const CATS_SPIKES = [
  { x: 1030, y: 530, w: 40, h: 30 },
  { x: 1870, y: 530, w: 40, h: 30 },
  { x: 6650, y: 530, w: 40, h: 30 },
];
const CATS_WINDZONES = [
  { rect: { x: 5450, y: 380, w: 700, h: 200 }, strength: 2.4, freq: 0.03, phase: 0 },
];
const CATS_CHECKPOINTS = [
  { zone: { x: 380, y: 400, w: 60, h: 160 }, spawn: { x: 400, y: 500 } },
  { zone: { x: 930, y: 400, w: 60, h: 160 }, spawn: { x: 950, y: 500 } },
  { zone: { x: 1730, y: 400, w: 60, h: 160 }, spawn: { x: 1750, y: 500 } },
  { zone: { x: 3410, y: 400, w: 60, h: 160 }, spawn: { x: 3430, y: 500 } },
  { zone: { x: 4260, y: 400, w: 60, h: 160 }, spawn: { x: 4280, y: 500 } },
  { zone: { x: 5260, y: 400, w: 60, h: 160 }, spawn: { x: 5280, y: 500 } },
  { zone: { x: 6160, y: 400, w: 60, h: 160 }, spawn: { x: 6180, y: 500 } },
  { zone: { x: 7110, y: 400, w: 60, h: 160 }, spawn: { x: 7130, y: 500 } },
  { zone: { x: 8140, y: 400, w: 60, h: 160 }, spawn: { x: 8160, y: 500 } },
];
const CATS_YARNS = [
  { x: 460, y: 520 }, { x: 780, y: 440 }, { x: 1030, y: 500 },
  { x: 1330, y: 450 }, { x: 2100, y: 460 }, { x: 2420, y: 520 },
  { x: 2820, y: 480 }, { x: 3150, y: 480 }, { x: 3900, y: 480 },
  { x: 4850, y: 300 }, { x: 5780, y: 480 }, { x: 6700, y: 500 },
  { x: 7800, y: 480 }, { x: 8850, y: 380 }, { x: 9250, y: 430 },
];
const CATS_FINISH_X = 9500;
const CATS_GOLD_MS = 150000;
const CATS_SILVER_MS = 270000;

const COLORS = ['#ff5252', '#40c4ff', '#69f0ae', '#ffd740', '#e040fb', '#ff6e40'];
const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MODES = ['tron', 'coop', 'cats'];

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
  const raw = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(raw);
  }
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
  if (mode === 'coop') return COOP_MAX_PLAYERS;
  if (mode === 'cats') return CATS_MAX_PLAYERS;
  return MAX_PLAYERS;
}

function minPlayersFor(mode) {
  return mode === 'tron' ? 2 : 1;
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ======================= دراجات الضوء (تنافسي) =======================

function startPositions(n) {
  const cx = GRID_W / 2;
  const cy = GRID_H / 2;
  const radius = Math.min(GRID_W, GRID_H) / 2 - 4;
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

function tronOccupied(room) {
  const occ = new Set(room.trailSet);
  for (const p of room.players.values()) occ.add(`${p.x},${p.y}`);
  for (const pu of room.powerups) occ.add(`${pu.x},${pu.y}`);
  return occ;
}

function tronFreeCell(room) {
  const avoid = tronOccupied(room);
  for (let attempt = 0; attempt < 300; attempt++) {
    const x = Math.floor(Math.random() * GRID_W);
    const y = Math.floor(Math.random() * GRID_H);
    const key = `${x},${y}`;
    if (avoid.has(key)) continue;
    return { x, y };
  }
  return null;
}

function tronSpawnPowerup(room) {
  const cell = tronFreeCell(room);
  if (cell) room.powerups.push(cell);
}

function resetRound(room) {
  const ids = [...room.players.keys()];
  const positions = startPositions(ids.length);
  room.trailSet = new Set();
  room.powerups = [];
  room.tronTick = 0;
  room.inset = 0;
  ids.forEach((id, i) => {
    const p = room.players.get(id);
    p.x = positions[i].x;
    p.y = positions[i].y;
    p.dir = positions[i].dir;
    p.nextDir = positions[i].dir;
    p.alive = true;
    p.shield = false;
    room.trailSet.add(`${p.x},${p.y}`);
  });
  for (let i = 0; i < TRON_POWERUP_COUNT; i++) tronSpawnPowerup(room);
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
    powerups: room.powerups,
    inset: 0,
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
  room.tronTick++;
  const maxInset = Math.floor(Math.min(GRID_W, GRID_H) / 2) - 6;
  if (room.tronTick >= SHRINK_START_TICKS) {
    room.inset = Math.min(maxInset, 1 + Math.floor((room.tronTick - SHRINK_START_TICKS) / SHRINK_INTERVAL_TICKS));
  }
  const inset = room.inset;

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
    if (nx < inset || nx >= GRID_W - inset || ny < inset || ny >= GRID_H - inset) dead = true;
    else if (room.trailSet.has(key)) dead = true;
    else if (headCellCounts.get(key) > 1) dead = true;

    if (dead) {
      if (p.shield) {
        p.shield = false;
        events.push({ id: p.id, x: p.x, y: p.y, alive: true, trailCell: null, shield: false, shieldUsed: true });
        continue;
      }
      p.alive = false;
      events.push({ id: p.id, x: p.x, y: p.y, alive: false, trailCell: null });
    } else {
      const puIdx = room.powerups.findIndex((pu) => pu.x === nx && pu.y === ny);
      if (puIdx !== -1) {
        room.powerups.splice(puIdx, 1);
        p.shield = true;
        tronSpawnPowerup(room);
      }
      room.trailSet.add(`${p.x},${p.y}`);
      const trailCell = { x: p.x, y: p.y };
      p.x = nx;
      p.y = ny;
      events.push({ id: p.id, x: p.x, y: p.y, alive: true, trailCell, shield: p.shield });
    }
  }

  broadcast(room, { type: 'tick', mode: 'tron', players: events, powerups: room.powerups, inset });

  const stillAlive = [...room.players.values()].filter((p) => p.alive);
  if (stillAlive.length <= 1) {
    endTronRound(room, stillAlive[0] || null);
  }
}

// ======================= غزو الجواهر (تعاوني) =======================

function coopOccupied(room) {
  const occ = new Set();
  for (const p of room.players.values()) occ.add(`${p.x},${p.y}`);
  for (const o of room.obstacles) occ.add(`${o.x},${o.y}`);
  for (const c of room.coins) occ.add(`${c.x},${c.y}`);
  for (const d of room.drones) occ.add(`${d.x},${d.y}`);
  if (room.shieldPickup) occ.add(`${room.shieldPickup.x},${room.shieldPickup.y}`);
  return occ;
}

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

function coopSpawnCoin(room) {
  room.coins.push(coopFreeCell(room, coopOccupied(room)));
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

function coopSpawnDrone(room) {
  const cell = coopFreeCell(room, coopOccupied(room));
  room.drones.push({ x: cell.x, y: cell.y });
}

function coopSpawnShield(room) {
  room.shieldPickup = coopFreeCell(room, coopOccupied(room));
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
    p.shield = false;
  });
  room.coins = [];
  room.obstacles = [];
  room.drones = [];
  room.shieldPickup = null;
  room.droneBeat = 0;
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
    drones: room.drones,
    shieldPickup: room.shieldPickup,
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
  for (const o of room.obstacles) {
    let nx = o.x + o.dx;
    let ny = o.y + o.dy;
    if (nx < 0 || nx >= COOP_GRID_W) { o.dx *= -1; nx = o.x + o.dx; }
    if (ny < 0 || ny >= COOP_GRID_H) { o.dy *= -1; ny = o.y + o.dy; }
    o.x = Math.max(0, Math.min(COOP_GRID_W - 1, nx));
    o.y = Math.max(0, Math.min(COOP_GRID_H - 1, ny));
  }

  room.droneBeat = (room.droneBeat + 1) % 2;
  if (room.droneBeat === 0) {
    for (const d of room.drones) {
      let target = null, bestDist = Infinity;
      for (const p of room.players.values()) {
        if (p.down) continue;
        const dist = Math.abs(p.x - d.x) + Math.abs(p.y - d.y);
        if (dist < bestDist) { bestDist = dist; target = p; }
      }
      if (target) {
        d.x = Math.max(0, Math.min(COOP_GRID_W - 1, d.x + Math.sign(target.x - d.x)));
        d.y = Math.max(0, Math.min(COOP_GRID_H - 1, d.y + Math.sign(target.y - d.y)));
      }
    }
  }

  if (!room.shieldPickup && Math.random() < COOP_SHIELD_SPAWN_CHANCE) coopSpawnShield(room);

  const dangerCells = new Set([
    ...room.obstacles.map((o) => `${o.x},${o.y}`),
    ...room.drones.map((d) => `${d.x},${d.y}`),
  ]);

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
      events.push({ id: p.id, x: p.x, y: p.y, down: p.down, dir: p.dir, shield: p.shield });
      continue;
    }

    if (p.nextDir) p.dir = p.nextDir;
    const d = DIRS[p.dir];
    const nx = p.x + d.x;
    const ny = p.y + d.y;
    const outOfBounds = nx < 0 || nx >= COOP_GRID_W || ny < 0 || ny >= COOP_GRID_H;
    const hitDanger = !outOfBounds && dangerCells.has(`${nx},${ny}`);

    if (outOfBounds || hitDanger) {
      if (p.shield) {
        p.shield = false;
        events.push({ id: p.id, x: p.x, y: p.y, down: false, dir: p.dir, shield: false, shieldUsed: true });
        continue;
      }
      room.lives--;
      p.down = true;
      p.downTicks = Math.max(1, Math.round(COOP_RESPAWN_MS / room.tickMs));
      events.push({ id: p.id, x: p.x, y: p.y, down: true, dir: p.dir, shield: p.shield });
      continue;
    }

    p.x = nx;
    p.y = ny;

    if (room.shieldPickup && room.shieldPickup.x === p.x && room.shieldPickup.y === p.y) {
      p.shield = true;
      room.shieldPickup = null;
    }

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
        if (room.level % 2 === 0 && room.drones.length < COOP_DRONE_MAX) coopSpawnDrone(room);
        leveledUp = true;
      }
    }

    events.push({ id: p.id, x: p.x, y: p.y, down: false, dir: p.dir, shield: p.shield });
  }

  broadcast(room, {
    type: 'tick',
    mode: 'coop',
    players: events,
    coins: room.coins,
    obstacles: room.obstacles,
    drones: room.drones,
    shieldPickup: room.shieldPickup,
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

// ======================= القطط المربوطة (تعاوني - منصات) =======================

function catsStep(p, platforms) {
  let newX = p.x + p.vx;
  const rectX = { x: newX, y: p.y, w: CAT_W, h: CAT_H };
  for (const pl of platforms) {
    if (pl.broken) continue;
    if (aabbOverlap(rectX, pl)) {
      if (p.vx > 0) newX = pl.x - CAT_W;
      else if (p.vx < 0) newX = pl.x + pl.w;
      p.vx = 0;
    }
  }
  p.x = newX;

  let newY = p.y + p.vy;
  const rectY = { x: p.x, y: newY, w: CAT_W, h: CAT_H };
  let grounded = false;
  let standingIdx = -1;
  for (let i = 0; i < platforms.length; i++) {
    const pl = platforms[i];
    if (pl.broken) continue;
    if (aabbOverlap(rectY, pl)) {
      if (p.vy > 0) { newY = pl.y - CAT_H; grounded = true; standingIdx = i; }
      else if (p.vy < 0) { newY = pl.y + pl.h; }
      p.vy = 0;
    }
  }
  p.y = newY;
  p.grounded = grounded;
  p.standingIdx = standingIdx;
}

function catsBuildPlatforms() {
  return CATS_PLATFORMS_BASE.map((pl) => ({
    ...pl,
    type: pl.type || 'static',
    baseX: pl.x,
    baseY: pl.y,
    broken: false,
    standTicks: 0,
    respawnTimer: 0,
  }));
}

function catsResetRound(room) {
  const ids = [...room.players.keys()];
  room.checkpointIndex = -1;
  room.spawnPoint = { x: 30, y: 480 };
  room.yarns = CATS_YARNS.map((y) => ({ ...y }));
  room.score = 0;
  room.combo = 0;
  room.lastYarnTick = -9999;
  room.catsTick = 0;
  room.catsPlatforms = catsBuildPlatforms();
  room.catsDynamicIdx = room.catsPlatforms
    .map((pl, idx) => (pl.type === 'moving' || pl.type === 'crumble' ? idx : -1))
    .filter((idx) => idx !== -1);
  room.pitState = room.catsPlatforms
    .map((pl, idx) => (pl.type === 'pitfloor' ? idx : -1))
    .filter((idx) => idx !== -1)
    .map((idx) => ({ idx, rescueProgress: 0, dragProgress: 0 }));
  ids.forEach((id, i) => {
    const p = room.players.get(id);
    p.x = room.spawnPoint.x + i * 24;
    p.y = room.spawnPoint.y;
    p.vx = 0;
    p.vy = 0;
    p.grounded = false;
    p.moveDir = 0;
    p.facing = 'right';
    p.coyoteTicks = 0;
    p.jumpBufferTicks = 0;
    p.standingIdx = -1;
    p.trapped = false;
    p.trappedPitIdx = -1;
    p.pulling = false;
  });
  room.status = 'playing';
}

function startCatsGame(room) {
  catsResetRound(room);
  const ids = [...room.players.keys()];
  broadcast(room, {
    type: 'start',
    mode: 'cats',
    world: { w: CATS_WORLD_W, h: CATS_WORLD_H },
    platforms: room.catsPlatforms,
    spikes: CATS_SPIKES,
    windzones: CATS_WINDZONES.map((w) => w.rect),
    checkpoints: CATS_CHECKPOINTS.map((c) => c.zone),
    finishX: CATS_FINISH_X,
    players: ids.map((id) => {
      const p = room.players.get(id);
      return { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, facing: p.facing };
    }),
    yarns: room.yarns,
    score: room.score,
  });
  if (room.interval) clearInterval(room.interval);
  room.interval = setInterval(() => tickCats(room), CATS_TICK_MS);
}

function endCatsRound(room) {
  room.status = 'lobby';
  clearInterval(room.interval);
  room.interval = null;
  const timeMs = room.catsTick * CATS_TICK_MS;
  const stars = timeMs <= CATS_GOLD_MS ? 3 : timeMs <= CATS_SILVER_MS ? 2 : 1;
  broadcast(room, {
    type: 'gameover',
    mode: 'cats',
    score: room.score,
    totalYarns: CATS_YARNS.length,
    timeMs,
    stars,
  });
}

function tickCats(room) {
  room.catsTick++;
  const tick = room.catsTick;
  const ids = [...room.players.keys()];
  if (ids.length === 0) return;
  const platforms = room.catsPlatforms;

  for (const pl of platforms) {
    if (pl.type === 'moving') {
      const off = Math.sin(tick * pl.speed + pl.phase) * pl.range;
      if (pl.axis === 'x') pl.x = pl.baseX + off;
      else pl.y = pl.baseY + off;
    } else if (pl.type === 'crumble') {
      if (pl.broken) {
        pl.respawnTimer--;
        if (pl.respawnTimer <= 0) { pl.broken = false; pl.standTicks = 0; }
      } else if (pl.standTicks > 0) {
        pl.standTicks = Math.max(0, pl.standTicks - 1);
      }
    }
  }

  const impactIds = new Set();
  for (const id of ids) {
    const p = room.players.get(id);
    if (p.trapped) { p.vx = 0; p.vy = 0; continue; }

    const wasGrounded = p.grounded;
    const targetVx = p.moveDir * CATS_MOVE_SPEED;
    if (p.standingType === 'ice') p.vx += (targetVx - p.vx) * CATS_ICE_ACCEL;
    else p.vx = targetVx;
    if (p.moveDir !== 0) p.facing = p.moveDir > 0 ? 'right' : 'left';

    for (const wz of CATS_WINDZONES) {
      const rect = { x: p.x, y: p.y, w: CAT_W, h: CAT_H };
      if (aabbOverlap(rect, wz.rect)) {
        p.vx += wz.strength * Math.sin(tick * wz.freq + wz.phase) * 0.15;
      }
    }

    p.vy = Math.min(p.vy + CATS_GRAVITY, CATS_MAX_FALL);
    const prevVy = p.vy;
    catsStep(p, platforms);
    p.x = Math.max(0, Math.min(CATS_WORLD_W - CAT_W, p.x));

    if (wasGrounded && !p.grounded) p.coyoteTicks = CATS_COYOTE_TICKS;
    else if (!p.grounded && p.coyoteTicks > 0) p.coyoteTicks--;

    if (p.jumpBufferTicks > 0) {
      p.jumpBufferTicks--;
      if (p.grounded) {
        p.vy = CATS_JUMP_V;
        p.grounded = false;
        p.jumpBufferTicks = 0;
        p.coyoteTicks = 0;
      }
    }

    p.standingType = null;
    if (p.standingIdx >= 0) {
      const pl = platforms[p.standingIdx];
      p.standingType = pl.type;
      if (!wasGrounded && prevVy >= CATS_IMPACT_VY) impactIds.add(p.id);
      if (pl.type === 'crumble' && !pl.broken) {
        pl.standTicks = Math.min(CATS_CRUMBLE_DELAY + 4, pl.standTicks + 2);
        if (pl.standTicks > CATS_CRUMBLE_DELAY) {
          pl.broken = true;
          pl.respawnTimer = CATS_CRUMBLE_RESPAWN;
        }
      }
      if (pl.type === 'bounce') {
        p.vy = CATS_BOUNCE_V;
        p.grounded = false;
      }
      if (pl.type === 'pitfloor' && !p.trapped) {
        p.trapped = true;
        p.trappedPitIdx = p.standingIdx;
        p.vx = 0;
        p.vy = 0;
      }
    }
  }

  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < ids.length - 1; i++) {
      const a = room.players.get(ids[i]);
      const b = room.players.get(ids[i + 1]);
      if (a.trapped && !b.trapped) {
        if (b.x > a.x + ROPE_LENGTH) b.x = a.x + ROPE_LENGTH;
        else if (b.x < a.x - ROPE_LENGTH) b.x = a.x - ROPE_LENGTH;
      } else if (b.trapped && !a.trapped) {
        if (a.x > b.x + ROPE_LENGTH) a.x = b.x + ROPE_LENGTH;
        else if (a.x < b.x - ROPE_LENGTH) a.x = b.x - ROPE_LENGTH;
      } else if (!a.trapped && !b.trapped) {
        const dx = b.x - a.x;
        if (Math.abs(dx) > ROPE_LENGTH) {
          const half = (Math.abs(dx) - ROPE_LENGTH) / 2 * Math.sign(dx);
          a.x += half; b.x -= half;
        }
      }
    }
  }

  // آلية الإنقاذ والسحب
  const rescueEvents = [];
  for (const pit of room.pitState) {
    const pl = platforms[pit.idx];
    const trappedIds = ids.filter((id) => {
      const p = room.players.get(id);
      return p.trapped && p.trappedPitIdx === pit.idx;
    });
    const pullerIds = trappedIds.length
      ? ids.filter((id) => {
          const p = room.players.get(id);
          if (p.trapped || !p.pulling || !p.grounded) return false;
          return trappedIds.some((tid) => {
            const t = room.players.get(tid);
            return Math.abs(p.x - t.x) < CATS_PULL_RANGE;
          });
        })
      : [];

    if (trappedIds.length === 0) {
      pit.rescueProgress = 0;
      pit.dragProgress = 0;
      continue;
    }

    if (pullerIds.length >= trappedIds.length) {
      pit.rescueProgress++;
      pit.dragProgress = Math.max(0, pit.dragProgress - 2);
      if (pit.rescueProgress >= CATS_PULL_SUCCESS_TICKS) {
        trappedIds.forEach((tid, i) => {
          const t = room.players.get(tid);
          t.trapped = false;
          t.trappedPitIdx = -1;
          t.vy = -10;
          t.grounded = false;
          t.x = pl.exitX + i * 20;
          t.y = pl.exitY;
        });
        pit.rescueProgress = 0;
        pit.dragProgress = 0;
        rescueEvents.push({ success: true });
      }
    } else if (pullerIds.length > 0) {
      pit.dragProgress++;
      pit.rescueProgress = Math.max(0, pit.rescueProgress - 1);
      if (pit.dragProgress >= CATS_DRAG_IN_TICKS) {
        for (const pid of pullerIds) {
          const puller = room.players.get(pid);
          puller.trapped = true;
          puller.trappedPitIdx = pit.idx;
          puller.vx = 0;
          puller.vy = 0;
          puller.x = pl.x + pl.w / 2 - CAT_W / 2;
          puller.y = pl.y + 4;
        }
        pit.dragProgress = 0;
        rescueEvents.push({ success: false, dragged: true });
      }
    } else {
      pit.rescueProgress = Math.max(0, pit.rescueProgress - 1);
      pit.dragProgress = Math.max(0, pit.dragProgress - 1);
    }
  }
  for (const ev of rescueEvents) broadcast(room, { type: 'rescue', ...ev });

  let needReset = false;
  for (const id of ids) {
    const p = room.players.get(id);
    if (p.trapped) continue;
    const rect = { x: p.x, y: p.y, w: CAT_W, h: CAT_H };
    if (p.y > CATS_WORLD_H) needReset = true;
    for (const s of CATS_SPIKES) {
      if (aabbOverlap(rect, s)) needReset = true;
    }
    CATS_CHECKPOINTS.forEach((cp, idx) => {
      if (idx > room.checkpointIndex && aabbOverlap(rect, cp.zone)) {
        room.checkpointIndex = idx;
        room.spawnPoint = cp.spawn;
        broadcast(room, { type: 'checkpoint', index: idx });
      }
    });
    room.yarns = room.yarns.filter((y) => {
      const hit = Math.abs(p.x + CAT_W / 2 - y.x) < 22 && Math.abs(p.y + CAT_H / 2 - y.y) < 22;
      if (hit) {
        if (tick - room.lastYarnTick <= CATS_COMBO_WINDOW_TICKS) room.combo++;
        else room.combo = 1;
        room.lastYarnTick = tick;
        room.score += room.combo;
      }
      return !hit;
    });
  }

  if (needReset) {
    ids.forEach((id, i) => {
      const p = room.players.get(id);
      p.x = room.spawnPoint.x + i * 24;
      p.y = room.spawnPoint.y;
      p.vx = 0;
      p.vy = 0;
      p.grounded = false;
      p.trapped = false;
      p.trappedPitIdx = -1;
    });
    broadcast(room, { type: 'hazard' });
  }

  broadcast(room, {
    type: 'tick',
    mode: 'cats',
    players: ids.map((id) => {
      const p = room.players.get(id);
      return {
        id: p.id, x: p.x, y: p.y, grounded: p.grounded, facing: p.facing,
        trapped: p.trapped, impact: impactIds.has(p.id),
      };
    }),
    platformUpdates: room.catsDynamicIdx.map((i) => {
      const pl = platforms[i];
      return { i, x: pl.x, y: pl.y, broken: pl.broken, standTicks: pl.standTicks };
    }),
    yarns: room.yarns,
    score: room.score,
    combo: room.combo,
    pits: room.pitState.map((pit) => ({ idx: pit.idx, rescueProgress: pit.rescueProgress, dragProgress: pit.dragProgress })),
  });

  const allFinished = ids.every((id) => room.players.get(id).x >= CATS_FINISH_X);
  if (allFinished) endCatsRound(room);
}

// ======================= اتصال WebSocket المشترك =======================

function startGame(room) {
  if (room.players.size < minPlayersFor(room.mode)) return;
  if (room.mode === 'coop') startCoopGame(room);
  else if (room.mode === 'cats') startCatsGame(room);
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
    } else if (room.mode === 'coop' && room.players.size === 0) {
      endCoopRound(room);
    }
  }

  broadcast(room, lobbyPayload(room));
}

function newPlayer(ws, name, color) {
  return {
    id: null,
    name,
    color,
    ws,
    alive: true,
    down: false,
    shield: false,
    x: 0, y: 0, vx: 0, vy: 0, grounded: false, moveDir: 0, facing: 'right',
    coyoteTicks: 0, jumpBufferTicks: 0, standingIdx: -1, standingType: null,
    trapped: false, pulling: false, trappedPitIdx: -1,
  };
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const action = url.searchParams.get('action');
  const code = (url.searchParams.get('code') || '').trim();
  const name = (url.searchParams.get('name') || 'لاعب').slice(0, 12);
  const modeRaw = url.searchParams.get('mode');
  const modeParam = MODES.includes(modeRaw) ? modeRaw : 'tron';

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
      powerups: [],
      tronTick: 0,
      inset: 0,
      coins: [],
      obstacles: [],
      drones: [],
      shieldPickup: null,
      droneBeat: 0,
      score: 0,
      level: 1,
      lives: 0,
      tickMs: COOP_TICK_START,
      checkpointIndex: -1,
      spawnPoint: { x: 30, y: 480 },
      yarns: [],
      catsTick: 0,
    };
    rooms.set(code, room);

    const playerId = Math.random().toString(36).slice(2, 10);
    const player = newPlayer(ws, name, COLORS[0]);
    player.id = playerId;
    room.players.set(playerId, player);
    room.hostId = playerId;
    ws.roomCode = code;
    ws.playerId = playerId;

    send(ws, { type: 'created', code, playerId, color: player.color, mode: room.mode });
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
    const player = newPlayer(ws, name, color);
    player.id = playerId;
    room.players.set(playerId, player);
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
    if (msg.type === 'dir' && room.status === 'playing' && DIRS[msg.dir] && room.mode !== 'cats') {
      const p = room.players.get(ws.playerId);
      if (!p) return;
      if (room.mode === 'tron') {
        if (p.alive) p.nextDir = msg.dir;
      } else if (!p.down) {
        p.nextDir = msg.dir;
      }
    }
    if (msg.type === 'move' && room.status === 'playing' && room.mode === 'cats') {
      const p = room.players.get(ws.playerId);
      if (p) p.moveDir = msg.dir === 'left' ? -1 : msg.dir === 'right' ? 1 : 0;
    }
    if (msg.type === 'jump' && room.status === 'playing' && room.mode === 'cats') {
      const p = room.players.get(ws.playerId);
      if (p && !p.trapped) {
        if (p.grounded || p.coyoteTicks > 0) {
          p.vy = CATS_JUMP_V;
          p.grounded = false;
          p.coyoteTicks = 0;
          p.jumpBufferTicks = 0;
        } else {
          p.jumpBufferTicks = CATS_JUMP_BUFFER_TICKS;
        }
      }
    }
    if (msg.type === 'pull' && room.status === 'playing' && room.mode === 'cats') {
      const p = room.players.get(ws.playerId);
      if (p) p.pulling = !!msg.held;
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
