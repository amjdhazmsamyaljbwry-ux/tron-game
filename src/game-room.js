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
const CATS_WORLD_W = 2600;
const CATS_WORLD_H = 760;
const CATS_PLATFORMS = [
  { x: 0, y: 560, w: 260, h: 200 },
  { x: 360, y: 560, w: 200, h: 200 },
  { x: 650, y: 480, w: 150, h: 200 },
  { x: 920, y: 560, w: 260, h: 200 },
  { x: 1270, y: 490, w: 120, h: 26 },
  { x: 1480, y: 420, w: 120, h: 26 },
  { x: 1720, y: 560, w: 220, h: 200 },
  { x: 2040, y: 500, w: 150, h: 26 },
  { x: 2290, y: 560, w: 270, h: 200 },
];
const CATS_SPIKES = [
  { x: 1030, y: 530, w: 40, h: 30 },
  { x: 1800, y: 530, w: 40, h: 30 },
];
const CATS_CHECKPOINTS = [
  { zone: { x: 380, y: 400, w: 60, h: 160 }, spawn: { x: 400, y: 500 } },
  { zone: { x: 930, y: 400, w: 60, h: 160 }, spawn: { x: 950, y: 500 } },
  { zone: { x: 1730, y: 400, w: 60, h: 160 }, spawn: { x: 1750, y: 500 } },
  { zone: { x: 2300, y: 400, w: 60, h: 160 }, spawn: { x: 2320, y: 500 } },
];
const CATS_YARNS = [
  { x: 460, y: 520 }, { x: 780, y: 440 }, { x: 1030, y: 500 },
  { x: 1330, y: 450 }, { x: 2100, y: 460 }, { x: 2420, y: 520 },
];
const CATS_FINISH_X = 2470;

const COLORS = ['#ff5252', '#40c4ff', '#69f0ae', '#ffd740', '#e040fb', '#ff6e40'];
const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MODES = ['tron', 'coop', 'cats'];

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

function coopStartPositions(n) {
  const spots = [
    { x: 2, y: 2 },
    { x: COOP_GRID_W - 3, y: 2 },
    { x: 2, y: COOP_GRID_H - 3 },
    { x: COOP_GRID_W - 3, y: COOP_GRID_H - 3 },
  ];
  return spots.slice(0, n);
}

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.code = null;
    this.mode = 'tron';
    this.hostId = null;
    this.players = new Map();
    this.status = 'empty'; // empty | lobby | playing
    this.trailSet = new Set();
    this.powerups = [];
    this.tronTick = 0;
    this.inset = 0;
    this.coins = [];
    this.obstacles = [];
    this.drones = [];
    this.shieldPickup = null;
    this.droneBeat = 0;
    this.score = 0;
    this.level = 1;
    this.lives = 0;
    this.tickMs = COOP_TICK_START;
    this.checkpointIndex = -1;
    this.spawnPoint = { x: 30, y: 480 };
    this.yarns = [];
    this.catsTick = 0;
    this.tickTimer = null;
  }

  send(ws, msg) {
    try {
      if (ws.readyState === 1) ws.send(JSON.stringify(msg));
    } catch {
      // socket already gone
    }
  }

  broadcast(msg) {
    for (const p of this.players.values()) this.send(p.ws, msg);
  }

  lobbyPayload() {
    return {
      type: 'lobby',
      code: this.code,
      mode: this.mode,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isHost: p.id === this.hostId,
      })),
    };
  }

  newPlayer(ws, name, color) {
    return {
      id: null, name, color, ws,
      alive: true, down: false, shield: false,
      x: 0, y: 0, vx: 0, vy: 0, grounded: false, moveDir: 0, facing: 'right',
      coyoteTicks: 0, jumpBufferTicks: 0,
    };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const code = (url.searchParams.get('code') || '').trim();
    const name = (url.searchParams.get('name') || 'لاعب').slice(0, 12);
    const modeRaw = url.searchParams.get('mode');
    const modeParam = MODES.includes(modeRaw) ? modeRaw : 'tron';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    if (action === 'create') {
      if (this.status !== 'empty') {
        this.send(server, { type: 'error', code: 'CODE_TAKEN', message: 'الرمز مستخدم بالفعل' });
        server.close(1000, 'code taken');
        return new Response(null, { status: 101, webSocket: client });
      }
      this.code = code;
      this.mode = modeParam;
      this.status = 'lobby';

      const playerId = crypto.randomUUID().slice(0, 8);
      const player = this.newPlayer(server, name, COLORS[0]);
      player.id = playerId;
      this.players.set(playerId, player);
      this.hostId = playerId;
      server.playerId = playerId;

      this.send(server, { type: 'created', code, playerId, color: player.color, mode: this.mode });
      this.broadcast(this.lobbyPayload());
    } else if (action === 'join') {
      if (this.status === 'empty') {
        this.send(server, { type: 'error', code: 'NOT_FOUND', message: 'الغرفة غير موجودة' });
        server.close(1000, 'not found');
        return new Response(null, { status: 101, webSocket: client });
      }
      if (this.status === 'playing') {
        this.send(server, { type: 'error', code: 'IN_PROGRESS', message: 'اللعبة بدأت بالفعل، انتظر الجولة القادمة' });
        server.close(1000, 'in progress');
        return new Response(null, { status: 101, webSocket: client });
      }
      if (this.players.size >= maxPlayersFor(this.mode)) {
        this.send(server, { type: 'error', code: 'FULL', message: 'الغرفة ممتلئة' });
        server.close(1000, 'full');
        return new Response(null, { status: 101, webSocket: client });
      }

      const playerId = crypto.randomUUID().slice(0, 8);
      const usedColors = new Set([...this.players.values()].map((p) => p.color));
      const color = COLORS.find((c) => !usedColors.has(c)) || COLORS[this.players.size % COLORS.length];
      const player = this.newPlayer(server, name, color);
      player.id = playerId;
      this.players.set(playerId, player);
      server.playerId = playerId;

      this.send(server, { type: 'joined', code: this.code, playerId, color, mode: this.mode });
      this.broadcast(this.lobbyPayload());
    } else {
      server.close(1000, 'bad request');
      return new Response(null, { status: 101, webSocket: client });
    }

    server.addEventListener('message', (ev) => this.onMessage(server.playerId, ev.data));
    server.addEventListener('close', () => this.onDisconnect(server.playerId));
    server.addEventListener('error', () => this.onDisconnect(server.playerId));

    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(playerId, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'start' && this.hostId === playerId) this.startGame();
    if (msg.type === 'restart' && this.hostId === playerId) this.startGame();
    if (msg.type === 'dir' && this.status === 'playing' && DIRS[msg.dir] && this.mode !== 'cats') {
      const p = this.players.get(playerId);
      if (!p) return;
      if (this.mode === 'tron') {
        if (p.alive) p.nextDir = msg.dir;
      } else if (!p.down) {
        p.nextDir = msg.dir;
      }
    }
    if (msg.type === 'move' && this.status === 'playing' && this.mode === 'cats') {
      const p = this.players.get(playerId);
      if (p) p.moveDir = msg.dir === 'left' ? -1 : msg.dir === 'right' ? 1 : 0;
    }
    if (msg.type === 'jump' && this.status === 'playing' && this.mode === 'cats') {
      const p = this.players.get(playerId);
      if (p) {
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
  }

  onDisconnect(playerId) {
    if (!this.players.has(playerId)) return;
    this.players.delete(playerId);

    if (this.players.size === 0) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.status = 'empty';
      this.code = null;
      this.hostId = null;
      return;
    }

    if (this.hostId === playerId) {
      this.hostId = [...this.players.keys()][0];
    }

    if (this.status === 'playing') {
      if (this.mode === 'tron') {
        const stillAlive = [...this.players.values()].filter((p) => p.alive);
        if (stillAlive.length <= 1) this.endTronRound(stillAlive[0] || null);
      } else if (this.mode === 'coop' && this.players.size === 0) {
        this.endCoopRound();
      }
    }

    this.broadcast(this.lobbyPayload());
  }

  startGame() {
    if (this.players.size < minPlayersFor(this.mode)) return;
    if (this.mode === 'coop') this.startCoopGame();
    else if (this.mode === 'cats') this.startCatsGame();
    else this.startTronGame();
  }

  // ======================= دراجات الضوء (تنافسي) =======================

  tronOccupied() {
    const occ = new Set(this.trailSet);
    for (const p of this.players.values()) occ.add(`${p.x},${p.y}`);
    for (const pu of this.powerups) occ.add(`${pu.x},${pu.y}`);
    return occ;
  }

  tronFreeCell() {
    const avoid = this.tronOccupied();
    for (let attempt = 0; attempt < 300; attempt++) {
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      const key = `${x},${y}`;
      if (avoid.has(key)) continue;
      return { x, y };
    }
    return null;
  }

  tronSpawnPowerup() {
    const cell = this.tronFreeCell();
    if (cell) this.powerups.push(cell);
  }

  resetRound() {
    const ids = [...this.players.keys()];
    const positions = startPositions(ids.length);
    this.trailSet = new Set();
    this.powerups = [];
    this.tronTick = 0;
    this.inset = 0;
    ids.forEach((id, i) => {
      const p = this.players.get(id);
      p.x = positions[i].x;
      p.y = positions[i].y;
      p.dir = positions[i].dir;
      p.nextDir = positions[i].dir;
      p.alive = true;
      p.shield = false;
      this.trailSet.add(`${p.x},${p.y}`);
    });
    for (let i = 0; i < TRON_POWERUP_COUNT; i++) this.tronSpawnPowerup();
    this.status = 'playing';
  }

  startTronGame() {
    this.resetRound();
    this.broadcast({
      type: 'start',
      mode: 'tron',
      grid: { w: GRID_W, h: GRID_H },
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        dir: p.dir,
      })),
      powerups: this.powerups,
      inset: 0,
    });
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tickTron(), TICK_MS);
  }

  endTronRound(winner) {
    this.status = 'lobby';
    clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.broadcast({
      type: 'gameover',
      mode: 'tron',
      winner: winner ? { id: winner.id, name: winner.name, color: winner.color } : null,
    });
  }

  tickTron() {
    this.tronTick++;
    const maxInset = Math.floor(Math.min(GRID_W, GRID_H) / 2) - 6;
    if (this.tronTick >= SHRINK_START_TICKS) {
      this.inset = Math.min(maxInset, 1 + Math.floor((this.tronTick - SHRINK_START_TICKS) / SHRINK_INTERVAL_TICKS));
    }
    const inset = this.inset;

    const alivePlayers = [...this.players.values()].filter((p) => p.alive);
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
      else if (this.trailSet.has(key)) dead = true;
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
        const puIdx = this.powerups.findIndex((pu) => pu.x === nx && pu.y === ny);
        if (puIdx !== -1) {
          this.powerups.splice(puIdx, 1);
          p.shield = true;
          this.tronSpawnPowerup();
        }
        this.trailSet.add(`${p.x},${p.y}`);
        const trailCell = { x: p.x, y: p.y };
        p.x = nx;
        p.y = ny;
        events.push({ id: p.id, x: p.x, y: p.y, alive: true, trailCell, shield: p.shield });
      }
    }

    this.broadcast({ type: 'tick', mode: 'tron', players: events, powerups: this.powerups, inset });

    const stillAlive = [...this.players.values()].filter((p) => p.alive);
    if (stillAlive.length <= 1) this.endTronRound(stillAlive[0] || null);
  }

  // ======================= غزو الجواهر (تعاوني) =======================

  coopOccupied() {
    const occ = new Set();
    for (const p of this.players.values()) occ.add(`${p.x},${p.y}`);
    for (const o of this.obstacles) occ.add(`${o.x},${o.y}`);
    for (const c of this.coins) occ.add(`${c.x},${c.y}`);
    for (const d of this.drones) occ.add(`${d.x},${d.y}`);
    if (this.shieldPickup) occ.add(`${this.shieldPickup.x},${this.shieldPickup.y}`);
    return occ;
  }

  coopFreeCell(avoid) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = Math.floor(Math.random() * COOP_GRID_W);
      const y = Math.floor(Math.random() * COOP_GRID_H);
      const key = `${x},${y}`;
      if (avoid.has(key)) continue;
      return { x, y };
    }
    return { x: Math.floor(COOP_GRID_W / 2), y: Math.floor(COOP_GRID_H / 2) };
  }

  coopSpawnCoin() {
    this.coins.push(this.coopFreeCell(this.coopOccupied()));
  }

  coopSpawnObstacle() {
    const cell = this.coopFreeCell(this.coopOccupied());
    const dirs = [-1, 0, 1];
    let dx = 0, dy = 0;
    while (dx === 0 && dy === 0) {
      dx = dirs[Math.floor(Math.random() * 3)];
      dy = dirs[Math.floor(Math.random() * 3)];
    }
    this.obstacles.push({ x: cell.x, y: cell.y, dx, dy });
  }

  coopSpawnDrone() {
    const cell = this.coopFreeCell(this.coopOccupied());
    this.drones.push({ x: cell.x, y: cell.y });
  }

  coopSpawnShield() {
    this.shieldPickup = this.coopFreeCell(this.coopOccupied());
  }

  coopResetRound() {
    const ids = [...this.players.keys()];
    const positions = coopStartPositions(ids.length);
    ids.forEach((id, i) => {
      const p = this.players.get(id);
      p.x = positions[i].x;
      p.y = positions[i].y;
      p.dir = 'right';
      p.nextDir = 'right';
      p.down = false;
      p.downTicks = 0;
      p.shield = false;
    });
    this.coins = [];
    this.obstacles = [];
    this.drones = [];
    this.shieldPickup = null;
    this.droneBeat = 0;
    this.score = 0;
    this.level = 1;
    this.lives = COOP_START_LIVES;
    this.tickMs = COOP_TICK_START;
    for (let i = 0; i < COOP_COIN_COUNT; i++) this.coopSpawnCoin();
    for (let i = 0; i < COOP_OBSTACLES_START; i++) this.coopSpawnObstacle();
    this.status = 'playing';
  }

  startCoopGame() {
    this.coopResetRound();
    this.broadcast({
      type: 'start',
      mode: 'coop',
      grid: { w: COOP_GRID_W, h: COOP_GRID_H },
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        dir: p.dir,
      })),
      coins: this.coins,
      obstacles: this.obstacles,
      drones: this.drones,
      shieldPickup: this.shieldPickup,
      score: this.score,
      lives: this.lives,
      level: this.level,
      tickMs: this.tickMs,
    });
    this.coopScheduleTick();
  }

  coopScheduleTick() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tickCoop(), this.tickMs);
  }

  endCoopRound() {
    this.status = 'lobby';
    clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.broadcast({ type: 'gameover', mode: 'coop', score: this.score, level: this.level });
  }

  tickCoop() {
    for (const o of this.obstacles) {
      let nx = o.x + o.dx;
      let ny = o.y + o.dy;
      if (nx < 0 || nx >= COOP_GRID_W) { o.dx *= -1; nx = o.x + o.dx; }
      if (ny < 0 || ny >= COOP_GRID_H) { o.dy *= -1; ny = o.y + o.dy; }
      o.x = Math.max(0, Math.min(COOP_GRID_W - 1, nx));
      o.y = Math.max(0, Math.min(COOP_GRID_H - 1, ny));
    }

    this.droneBeat = (this.droneBeat + 1) % 2;
    if (this.droneBeat === 0) {
      for (const d of this.drones) {
        let target = null, bestDist = Infinity;
        for (const p of this.players.values()) {
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

    if (!this.shieldPickup && Math.random() < COOP_SHIELD_SPAWN_CHANCE) this.coopSpawnShield();

    const dangerCells = new Set([
      ...this.obstacles.map((o) => `${o.x},${o.y}`),
      ...this.drones.map((d) => `${d.x},${d.y}`),
    ]);

    const events = [];
    let leveledUp = false;

    for (const p of this.players.values()) {
      if (p.down) {
        p.downTicks--;
        if (p.downTicks <= 0) {
          const cell = this.coopFreeCell(this.coopOccupied());
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
        this.lives--;
        p.down = true;
        p.downTicks = Math.max(1, Math.round(COOP_RESPAWN_MS / this.tickMs));
        events.push({ id: p.id, x: p.x, y: p.y, down: true, dir: p.dir, shield: p.shield });
        continue;
      }

      p.x = nx;
      p.y = ny;

      if (this.shieldPickup && this.shieldPickup.x === p.x && this.shieldPickup.y === p.y) {
        p.shield = true;
        this.shieldPickup = null;
      }

      const coinIdx = this.coins.findIndex((c) => c.x === p.x && c.y === p.y);
      if (coinIdx !== -1) {
        this.coins.splice(coinIdx, 1);
        this.score++;
        this.coopSpawnCoin();
        const newLevel = 1 + Math.floor(this.score / COOP_LEVEL_STEP);
        if (newLevel > this.level) {
          this.level = newLevel;
          this.tickMs = Math.max(COOP_TICK_MIN, COOP_TICK_START - (this.level - 1) * COOP_TICK_STEP);
          if (this.obstacles.length < COOP_OBSTACLES_MAX) this.coopSpawnObstacle();
          if (this.level % 2 === 0 && this.drones.length < COOP_DRONE_MAX) this.coopSpawnDrone();
          leveledUp = true;
        }
      }

      events.push({ id: p.id, x: p.x, y: p.y, down: false, dir: p.dir, shield: p.shield });
    }

    this.broadcast({
      type: 'tick',
      mode: 'coop',
      players: events,
      coins: this.coins,
      obstacles: this.obstacles,
      drones: this.drones,
      shieldPickup: this.shieldPickup,
      score: this.score,
      lives: this.lives,
      level: this.level,
      tickMs: this.tickMs,
    });

    if (this.lives <= 0) {
      this.endCoopRound();
      return;
    }
    if (leveledUp) {
      this.broadcast({ type: 'levelup', level: this.level, score: this.score });
      this.coopScheduleTick();
    }
  }

  // ======================= القطط المربوطة (تعاوني - منصات) =======================

  catsStep(p, platforms) {
    let newX = p.x + p.vx;
    const rectX = { x: newX, y: p.y, w: CAT_W, h: CAT_H };
    for (const pl of platforms) {
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
    for (const pl of platforms) {
      if (aabbOverlap(rectY, pl)) {
        if (p.vy > 0) { newY = pl.y - CAT_H; grounded = true; }
        else if (p.vy < 0) { newY = pl.y + pl.h; }
        p.vy = 0;
      }
    }
    p.y = newY;
    p.grounded = grounded;
  }

  catsResetRound() {
    const ids = [...this.players.keys()];
    this.checkpointIndex = -1;
    this.spawnPoint = { x: 30, y: 480 };
    this.yarns = CATS_YARNS.map((y) => ({ ...y }));
    this.score = 0;
    this.catsTick = 0;
    ids.forEach((id, i) => {
      const p = this.players.get(id);
      p.x = this.spawnPoint.x + i * 24;
      p.y = this.spawnPoint.y;
      p.vx = 0;
      p.vy = 0;
      p.grounded = false;
      p.moveDir = 0;
      p.facing = 'right';
      p.coyoteTicks = 0;
      p.jumpBufferTicks = 0;
    });
    this.status = 'playing';
  }

  startCatsGame() {
    this.catsResetRound();
    const ids = [...this.players.keys()];
    this.broadcast({
      type: 'start',
      mode: 'cats',
      world: { w: CATS_WORLD_W, h: CATS_WORLD_H },
      platforms: CATS_PLATFORMS,
      spikes: CATS_SPIKES,
      checkpoints: CATS_CHECKPOINTS.map((c) => c.zone),
      finishX: CATS_FINISH_X,
      players: ids.map((id) => {
        const p = this.players.get(id);
        return { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, facing: p.facing };
      }),
      yarns: this.yarns,
      score: this.score,
    });
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tickCats(), CATS_TICK_MS);
  }

  endCatsRound() {
    this.status = 'lobby';
    clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.broadcast({
      type: 'gameover',
      mode: 'cats',
      score: this.score,
      totalYarns: CATS_YARNS.length,
      timeMs: this.catsTick * CATS_TICK_MS,
    });
  }

  tickCats() {
    this.catsTick++;
    const ids = [...this.players.keys()];
    if (ids.length === 0) return;

    for (const id of ids) {
      const p = this.players.get(id);
      const wasGrounded = p.grounded;
      p.vx = p.moveDir * CATS_MOVE_SPEED;
      if (p.moveDir !== 0) p.facing = p.moveDir > 0 ? 'right' : 'left';
      p.vy = Math.min(p.vy + CATS_GRAVITY, CATS_MAX_FALL);
      this.catsStep(p, CATS_PLATFORMS);
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
    }

    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < ids.length - 1; i++) {
        const a = this.players.get(ids[i]);
        const b = this.players.get(ids[i + 1]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        if (dist > ROPE_LENGTH) {
          const diff = (dist - ROPE_LENGTH) / dist / 2;
          const offX = dx * diff;
          const offY = dy * diff;
          a.x += offX; a.y += offY;
          b.x -= offX; b.y -= offY;
        }
      }
    }

    let needReset = false;
    for (const id of ids) {
      const p = this.players.get(id);
      const rect = { x: p.x, y: p.y, w: CAT_W, h: CAT_H };
      if (p.y > CATS_WORLD_H) needReset = true;
      for (const s of CATS_SPIKES) {
        if (aabbOverlap(rect, s)) needReset = true;
      }
      CATS_CHECKPOINTS.forEach((cp, idx) => {
        if (idx > this.checkpointIndex && aabbOverlap(rect, cp.zone)) {
          this.checkpointIndex = idx;
          this.spawnPoint = cp.spawn;
          this.broadcast({ type: 'checkpoint', index: idx });
        }
      });
      this.yarns = this.yarns.filter((y) => {
        const hit = Math.abs(p.x + CAT_W / 2 - y.x) < 22 && Math.abs(p.y + CAT_H / 2 - y.y) < 22;
        if (hit) this.score++;
        return !hit;
      });
    }

    if (needReset) {
      ids.forEach((id, i) => {
        const p = this.players.get(id);
        p.x = this.spawnPoint.x + i * 24;
        p.y = this.spawnPoint.y;
        p.vx = 0;
        p.vy = 0;
        p.grounded = false;
      });
      this.broadcast({ type: 'hazard' });
    }

    this.broadcast({
      type: 'tick',
      mode: 'cats',
      players: ids.map((id) => {
        const p = this.players.get(id);
        return { id: p.id, x: p.x, y: p.y, grounded: p.grounded, facing: p.facing };
      }),
      yarns: this.yarns,
      score: this.score,
    });

    const allFinished = ids.every((id) => this.players.get(id).x >= CATS_FINISH_X);
    if (allFinished) this.endCatsRound();
  }
}
