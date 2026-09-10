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

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.code = null;
    this.hostId = null;
    this.players = new Map();
    this.status = 'empty'; // empty | lobby | playing
    this.trailSet = new Set();
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
      this.status = 'lobby';

      const playerId = crypto.randomUUID().slice(0, 8);
      const color = COLORS[0];
      const player = { id: playerId, name, color, ws: server, alive: true };
      this.players.set(playerId, player);
      this.hostId = playerId;
      server.playerId = playerId;

      this.send(server, { type: 'created', code, playerId, color });
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
      if (this.players.size >= MAX_PLAYERS) {
        this.send(server, { type: 'error', code: 'FULL', message: 'الغرفة ممتلئة' });
        server.close(1000, 'full');
        return new Response(null, { status: 101, webSocket: client });
      }

      const playerId = crypto.randomUUID().slice(0, 8);
      const usedColors = new Set([...this.players.values()].map((p) => p.color));
      const color = COLORS.find((c) => !usedColors.has(c)) || COLORS[this.players.size % COLORS.length];
      const player = { id: playerId, name, color, ws: server, alive: true };
      this.players.set(playerId, player);
      server.playerId = playerId;

      this.send(server, { type: 'joined', code: this.code, playerId, color });
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
    if (msg.type === 'dir' && this.status === 'playing') {
      const p = this.players.get(playerId);
      if (p && p.alive && DIRS[msg.dir]) p.nextDir = msg.dir;
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
      const stillAlive = [...this.players.values()].filter((p) => p.alive);
      if (stillAlive.length <= 1) this.endRound(stillAlive[0] || null);
    }

    this.broadcast(this.lobbyPayload());
  }

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

  startGame() {
    if (this.players.size < 2) return;
    this.resetRound();
    this.broadcast({
      type: 'start',
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
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
  }

  endRound(winner) {
    this.status = 'lobby';
    clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.broadcast({
      type: 'gameover',
      winner: winner ? { id: winner.id, name: winner.name, color: winner.color } : null,
    });
  }

  tick() {
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

    this.broadcast({ type: 'tick', players: events });

    const stillAlive = [...this.players.values()].filter((p) => p.alive);
    if (stillAlive.length <= 1) this.endRound(stillAlive[0] || null);
  }
}
