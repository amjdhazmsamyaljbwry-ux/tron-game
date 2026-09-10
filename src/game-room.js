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
    this.catsPlatforms = [];
    this.catsDynamicIdx = [];
    this.pitState = [];
    this.combo = 0;
    this.lastYarnTick = -9999;
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
    const raw = JSON.stringify(msg);
    for (const p of this.players.values()) {
      try {
        if (p.ws.readyState === 1) p.ws.send(raw);
      } catch {
        // socket already gone
      }
    }
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
      coyoteTicks: 0, jumpBufferTicks: 0, standingIdx: -1, standingType: null,
      trapped: false, pulling: false, trappedPitIdx: -1,
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
    if (msg.type === 'pull' && this.status === 'playing' && this.mode === 'cats') {
      const p = this.players.get(playerId);
      if (p) p.pulling = !!msg.held;
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

  catsBuildPlatforms() {
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

  catsResetRound() {
    const ids = [...this.players.keys()];
    this.checkpointIndex = -1;
    this.spawnPoint = { x: 30, y: 480 };
    this.yarns = CATS_YARNS.map((y) => ({ ...y }));
    this.score = 0;
    this.combo = 0;
    this.lastYarnTick = -9999;
    this.catsTick = 0;
    this.catsPlatforms = this.catsBuildPlatforms();
    this.catsDynamicIdx = this.catsPlatforms
      .map((pl, idx) => (pl.type === 'moving' || pl.type === 'crumble' ? idx : -1))
      .filter((idx) => idx !== -1);
    this.pitState = this.catsPlatforms
      .map((pl, idx) => (pl.type === 'pitfloor' ? idx : -1))
      .filter((idx) => idx !== -1)
      .map((idx) => ({ idx, rescueProgress: 0, dragProgress: 0 }));
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
      p.standingIdx = -1;
      p.trapped = false;
      p.trappedPitIdx = -1;
      p.pulling = false;
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
      platforms: this.catsPlatforms,
      spikes: CATS_SPIKES,
      windzones: CATS_WINDZONES.map((w) => w.rect),
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
    const timeMs = this.catsTick * CATS_TICK_MS;
    const stars = timeMs <= CATS_GOLD_MS ? 3 : timeMs <= CATS_SILVER_MS ? 2 : 1;
    this.broadcast({
      type: 'gameover',
      mode: 'cats',
      score: this.score,
      totalYarns: CATS_YARNS.length,
      timeMs,
      stars,
    });
  }

  tickCats() {
    this.catsTick++;
    const tick = this.catsTick;
    const ids = [...this.players.keys()];
    if (ids.length === 0) return;
    const platforms = this.catsPlatforms;

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
      const p = this.players.get(id);
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
      this.catsStep(p, platforms);
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
        const a = this.players.get(ids[i]);
        const b = this.players.get(ids[i + 1]);
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
    for (const pit of this.pitState) {
      const pl = platforms[pit.idx];
      const trappedIds = ids.filter((id) => {
        const p = this.players.get(id);
        return p.trapped && p.trappedPitIdx === pit.idx;
      });
      const pullerIds = trappedIds.length
        ? ids.filter((id) => {
            const p = this.players.get(id);
            if (p.trapped || !p.pulling || !p.grounded) return false;
            return trappedIds.some((tid) => {
              const t = this.players.get(tid);
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
            const t = this.players.get(tid);
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
            const puller = this.players.get(pid);
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
    for (const ev of rescueEvents) this.broadcast({ type: 'rescue', ...ev });

    let needReset = false;
    for (const id of ids) {
      const p = this.players.get(id);
      if (p.trapped) continue;
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
        if (hit) {
          if (tick - this.lastYarnTick <= CATS_COMBO_WINDOW_TICKS) this.combo++;
          else this.combo = 1;
          this.lastYarnTick = tick;
          this.score += this.combo;
        }
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
        p.trapped = false;
        p.trappedPitIdx = -1;
      });
      this.broadcast({ type: 'hazard' });
    }

    this.broadcast({
      type: 'tick',
      mode: 'cats',
      players: ids.map((id) => {
        const p = this.players.get(id);
        return {
          id: p.id, x: p.x, y: p.y, grounded: p.grounded, facing: p.facing,
          trapped: p.trapped, impact: impactIds.has(p.id),
        };
      }),
      platformUpdates: this.catsDynamicIdx.map((i) => {
        const pl = platforms[i];
        return { i, x: pl.x, y: pl.y, broken: pl.broken, standTicks: pl.standTicks };
      }),
      yarns: this.yarns,
      score: this.score,
      combo: this.combo,
      pits: this.pitState.map((pit) => ({ idx: pit.idx, rescueProgress: pit.rescueProgress, dragProgress: pit.dragProgress })),
    });

    const allFinished = ids.every((id) => this.players.get(id).x >= CATS_FINISH_X);
    if (allFinished) this.endCatsRound();
  }
}
