(() => {
  const TICK_MS = 110;

  const screens = {
    home: document.getElementById('screen-home'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game'),
  };
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  const nameInput = document.getElementById('name-input');
  const codeInput = document.getElementById('code-input');
  const homeError = document.getElementById('home-error');
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');

  const roomCodeEl = document.getElementById('room-code');
  const playerListEl = document.getElementById('player-list');
  const btnStart = document.getElementById('btn-start');
  const lobbyHint = document.getElementById('lobby-hint');

  const hud = document.getElementById('hud');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayHint = document.getElementById('overlay-hint');
  const btnRestart = document.getElementById('btn-restart');

  let myId = null;
  let isHost = false;
  let roomCode = null;

  let grid = { w: 44, h: 28 };
  let players = new Map(); // id -> render state
  let trailLayer = document.createElement('canvas');
  let trailCtx = trailLayer.getContext('2d');
  let cellSize = 10;

  const savedName = localStorage.getItem('tron_name') || '';
  nameInput.value = savedName;

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  function randomCode() {
    return Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  }

  let ws = null;
  let connGen = 0;
  let gotResponse = false;
  let createRetriesLeft = 0;

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function connect(action, code, name) {
    if (ws) ws.close();
    const myGen = ++connGen;
    gotResponse = false;
    homeError.textContent = '';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws?action=${action}&code=${code}&name=${encodeURIComponent(name)}`;
    ws = new WebSocket(url);
    ws.addEventListener('message', (ev) => {
      if (myGen !== connGen) return;
      handleMessage(ev);
    });
    ws.addEventListener('close', () => {
      if (myGen !== connGen) return;
      if (!gotResponse) {
        homeError.textContent = 'تعذّر الاتصال بالخادم. حاول مرة أخرى.';
      } else if (screens.game.classList.contains('active') || screens.lobby.classList.contains('active')) {
        overlayHint.textContent = 'انقطع الاتصال بالخادم.';
      }
    });
  }

  btnCreate.addEventListener('click', () => {
    const name = (nameInput.value || 'لاعب').trim().slice(0, 12) || 'لاعب';
    localStorage.setItem('tron_name', name);
    createRetriesLeft = 5;
    connect('create', randomCode(), name);
  });

  btnJoin.addEventListener('click', () => {
    const name = (nameInput.value || 'لاعب').trim().slice(0, 12) || 'لاعب';
    const code = (codeInput.value || '').trim().toUpperCase();
    if (code.length !== 4) {
      homeError.textContent = 'أدخل رمز غرفة مكوّن من 4 أحرف';
      return;
    }
    localStorage.setItem('tron_name', name);
    connect('join', code, name);
  });

  btnStart.addEventListener('click', () => send({ type: 'start' }));
  btnRestart.addEventListener('click', () => send({ type: 'restart' }));

  function handleMessage(ev) {
    const msg = JSON.parse(ev.data);
    gotResponse = true;

    if (msg.type === 'error') {
      if (msg.code === 'CODE_TAKEN' && createRetriesLeft > 0) {
        createRetriesLeft--;
        const name = (nameInput.value || 'لاعب').trim().slice(0, 12) || 'لاعب';
        connect('create', randomCode(), name);
        return;
      }
      homeError.textContent = msg.message;
      showScreen('home');
    }

    if (msg.type === 'created' || msg.type === 'joined') {
      myId = msg.playerId;
      roomCode = msg.code;
      showScreen('lobby');
      roomCodeEl.textContent = msg.code;
    }

    if (msg.type === 'lobby') {
      roomCode = msg.code;
      roomCodeEl.textContent = msg.code;
      playerListEl.innerHTML = '';
      isHost = false;
      msg.players.forEach((p) => {
        if (p.id === myId && p.isHost) isHost = true;
        const li = document.createElement('li');
        li.innerHTML = `<span class="dot" style="background:${p.color};color:${p.color}"></span>
          <span>${escapeHtml(p.name)}</span>
          ${p.isHost ? '<span class="host-tag">مضيف</span>' : ''}`;
        playerListEl.appendChild(li);
      });
      btnStart.classList.toggle('hidden', !isHost);
      lobbyHint.classList.toggle('hidden', isHost);
      btnStart.disabled = msg.players.length < 2;
      showScreen('lobby');
    }

    if (msg.type === 'start') {
      grid = msg.grid;
      players = new Map();
      msg.players.forEach((p) => {
        players.set(p.id, {
          name: p.name,
          color: p.color,
          alive: true,
          x: p.x,
          y: p.y,
          prevX: p.x,
          prevY: p.y,
          lastTick: performance.now(),
        });
      });
      setupCanvas();
      overlay.classList.add('hidden');
      showScreen('game');
      renderHud();
    }

    if (msg.type === 'tick') {
      const now = performance.now();
      msg.players.forEach((ev) => {
        const p = players.get(ev.id);
        if (!p) return;
        if (ev.trailCell) {
          drawTrailCell(ev.trailCell.x, ev.trailCell.y, p.color);
        }
        p.prevX = p.x;
        p.prevY = p.y;
        p.x = ev.x;
        p.y = ev.y;
        p.alive = ev.alive;
        p.lastTick = now;
      });
      renderHud();
    }

    if (msg.type === 'gameover') {
      if (msg.winner) {
        overlayTitle.innerHTML = `🏆 فاز <span style="color:${msg.winner.color}">${escapeHtml(msg.winner.name)}</span>`;
      } else {
        overlayTitle.textContent = 'تعادل! لا يوجد فائز';
      }
      btnRestart.classList.toggle('hidden', !isHost);
      overlayHint.textContent = isHost ? '' : 'بانتظار المضيف لبدء جولة جديدة…';
      overlay.classList.remove('hidden');
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderHud() {
    hud.innerHTML = '';
    players.forEach((p) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (p.alive ? '' : ' dead');
      chip.innerHTML = `<span class="dot" style="background:${p.color}"></span>${escapeHtml(p.name)}`;
      hud.appendChild(chip);
    });
  }

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const availW = canvas.clientWidth || window.innerWidth;
    const availH = canvas.clientHeight || window.innerHeight;
    cellSize = Math.floor(Math.min(availW / grid.w, availH / grid.h));
    const pixelW = cellSize * grid.w;
    const pixelH = cellSize * grid.h;

    canvas.width = availW * dpr;
    canvas.height = availH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    trailLayer.width = pixelW;
    trailLayer.height = pixelH;
    trailCtx.clearRect(0, 0, pixelW, pixelH);

    canvas.offsetXPx = Math.floor((availW - pixelW) / 2);
    canvas.offsetYPx = Math.floor((availH - pixelH) / 2);
  }

  window.addEventListener('resize', () => {
    if (screens.game.classList.contains('active')) setupCanvas();
  });

  function drawTrailCell(x, y, color) {
    trailCtx.fillStyle = color;
    trailCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!screens.game.classList.contains('active')) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    const ox = canvas.offsetXPx || 0;
    const oy = canvas.offsetYPx || 0;

    ctx.drawImage(trailLayer, ox, oy);

    ctx.strokeStyle = 'rgba(64,196,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, cellSize * grid.w, cellSize * grid.h);

    const now = performance.now();
    players.forEach((p) => {
      if (!p.alive) return;
      const t = Math.min(1, (now - p.lastTick) / TICK_MS);
      const px = p.prevX + (p.x - p.prevX) * t;
      const py = p.prevY + (p.y - p.prevY) * t;
      const cx = ox + px * cellSize + cellSize / 2;
      const cy = oy + py * cellSize + cellSize / 2;

      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
  requestAnimationFrame(frame);

  // ---- controls ----
  let lastSentDir = null;
  function sendDir(dir) {
    if (dir === lastSentDir) return;
    lastSentDir = dir;
    send({ type: 'dir', dir });
  }

  const keyMap = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };
  window.addEventListener('keydown', (e) => {
    const dir = keyMap[e.code];
    if (dir) {
      e.preventDefault();
      sendDir(dir);
    }
  });

  document.querySelectorAll('.pad-btn').forEach((btn) => {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sendDir(dir);
    });
  });

  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) sendDir(dx > 0 ? 'right' : 'left');
    else sendDir(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  // reset lastSentDir tracking per tick isn't ideal since server ignores reverse anyway;
  // allow re-sending same direction key doesn't matter, but avoid spamming identical dir:
  setInterval(() => { lastSentDir = null; }, TICK_MS);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
