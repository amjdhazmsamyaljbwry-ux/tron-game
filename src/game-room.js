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

function maxPlayersFor(mode) {
  return mode === 'coop' ? COOP_MAX_PLAYERS : MAX_PLAYERS;
}

function minPlayersFor(mode) {
  return mode === 'coop' ? 1 : 2;
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
    this.coins = [];
    this.obstacles = [];
    this.score = 0;
    this.level = 1;
    this.lives = 0;
    this.tickMs = COOP_TICK_START;
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

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const code = (url.searchParams.get('code') || '').toUpperCase();
    const name = (url.searchParams.get('name') || 'لاعب').slice(0, 12);
    const modeParam = url.searchParams.get('mode') === 'coop' ? 'coop' : 'tron';

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
      const color = COLORS[0];
      const player = { id: playerId, name, color, ws: server, alive: true, down: false };
      this.players.set(playerId, player);
      this.hostId = playerId;
      server.playerId = playerId;

      this.send(server, { type: 'created', code, playerId, color, mode: this.mode });
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
      const player = { id: playerId, name, color, ws: server, alive: true, down: false };
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
    if (msg.type === 'dir' && this.status === 'playing' && DIRS[msg.dir]) {
      const p = this.players.get(playerId);
      if (!p) return;
      if (this.mode === 'tron') {
        if (p.alive) p.nextDir = msg.dir;
      } else if (!p.down) {
        p.nextDir = msg.dir;
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
      } else if (this.players.size === 0) {
        this.endCoopRound();
      }
    }

    this.broadcast(this.lobbyPayload());
  }

  startGame() {
    if (this.players.size < minPlayersFor(this.mode)) return;
    if (this.mode === 'coop') this.startCoopGame();
    else this.startTronGame();
  }

  // ======================= دراجات الضوء (تنافسي) =======================

  resetRound() {
    const ids = [...this.players.keys()];
    const positions = startPositions(ids.length);
    this.trailSet = new Set();
    ids.forEach((id, i) => {
      const p = this.players.get(id);
      p.x = positions[i].x;
      p.y = positions[i].y;
      p.dir = positions[i].dir;
      p.nextDir = positions[i].dir;
      p.alive = true;
      this.trailSet.add(`${p.x},${p.y}`);
    });
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
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) dead = true;
      else if (this.trailSet.has(key)) dead = true;
      else if (headCellCounts.get(key) > 1) dead = true;

      if (dead) {
        p.alive = false;
        events.push({ id: p.id, x: p.x, y: p.y, alive: false, trailCell: null });
      } else {
        this.trailSet.add(`${p.x},${p.y}`);
        const trailCell = { x: p.x, y: p.y };
        p.x = nx;
        p.y = ny;
        events.push({ id: p.id, x: p.x, y: p.y, alive: true, trailCell });
      }
    }

    this.broadcast({ type: 'tick', mode: 'tron', players: events });

    const stillAlive = [...this.players.values()].filter((p) => p.alive);
    if (stillAlive.length <= 1) this.endTronRound(stillAlive[0] || null);
  }

  // ======================= غزو الجواهر (تعاوني) =======================

  coopOccupied() {
    const occ = new Set();
    for (const p of this.players.values()) occ.add(`${p.x},${p.y}`);
    for (const o of this.obstacles) occ.add(`${o.x},${o.y}`);
    for (const c of this.coins) occ.add(`${c.x},${c.y}`);
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
    const cell = this.coopFreeCell(this.coopOccupied());
    this.coins.push(cell);
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
    });
    this.coins = [];
    this.obstacles = [];
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
    const obstacleCells = new Set(this.obstacles.map((o) => `${o.x},${o.y}`));

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
        this.lives--;
        p.down = true;
        p.downTicks = Math.max(1, Math.round(COOP_RESPAWN_MS / this.tickMs));
        events.push({ id: p.id, x: p.x, y: p.y, down: true, dir: p.dir });
        continue;
      }

      p.x = nx;
      p.y = ny;

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
          leveledUp = true;
        }
      }

      events.push({ id: p.id, x: p.x, y: p.y, down: false, dir: p.dir });
    }

    this.broadcast({
      type: 'tick',
      mode: 'coop',
      players: events,
      coins: this.coins,
      obstacles: this.obstacles,
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
}
