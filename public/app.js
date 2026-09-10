(() => {
  const BASE_TICK_MS = 110;
  let currentTickMs = BASE_TICK_MS;

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
  const modeSelect = document.getElementById('mode-select');

  const lobbyModeHint = document.getElementById('lobby-mode-hint');
  const roomCodeEl = document.getElementById('room-code');
  const playerListEl = document.getElementById('player-list');
  const btnStart = document.getElementById('btn-start');
  const lobbyHint = document.getElementById('lobby-hint');

  const hud = document.getElementById('hud');
  const coopHud = document.getElementById('coop-hud');
  const coopScoreEl = document.getElementById('coop-score');
  const coopLivesEl = document.getElementById('coop-lives');
  const coopLevelEl = document.getElementById('coop-level');
  const toastEl = document.getElementById('toast');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayHint = document.getElementById('overlay-hint');
  const btnRestart = document.getElementById('btn-restart');

  const MODE_INFO = {
    tron: { subtitle: 'لعبة سريعة متعددة اللاعبين — اصنع مسارًا وتفادَ الاصطدام!' },
    coop: { subtitle: 'تعاونوا كطاقم فضائي واحد لجمع أكبر عدد من الجواهر قبل نفاد الأرواح!' },
  };

  let selectedMode = 'tron';
  modeSelect.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      selectedMode = card.dataset.mode;
      modeSelect.querySelectorAll('.mode-card').forEach((c) => c.classList.toggle('active', c === card));
      document.getElementById('home-subtitle').textContent = MODE_INFO[selectedMode].subtitle;
    });
  });

  let myId = null;
  let isHost = false;
  let roomCode = null;
  let currentMode = 'tron';

  let grid = { w: 44, h: 28 };
  let players = new Map(); // id -> render state
  let trailLayer = document.createElement('canvas');
  let trailCtx = trailLayer.getContext('2d');
  let cellSize = 10;
  let stars = [];

  // co-op state
  let coins = [];
  let obstacles = [];
  let coopScore = 0;
  let coopLives = 0;
  let coopLevel = 1;
  let toastTimer = null;

  const savedName = localStorage.getItem('tron_name') || '';
  nameInput.value = savedName;

  function randomCode() {
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }

  let ws = null;
  let connGen = 0;
  let gotResponse = false;
  let createRetriesLeft = 0;

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function connect(action, code, name, mode) {
    if (ws) ws.close();
    const myGen = ++connGen;
    gotResponse = false;
    homeError.textContent = '';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const modeParam = mode ? `&mode=${mode}` : '';
    const url = `${proto}://${location.host}/ws?action=${action}&code=${code}&name=${encodeURIComponent(name)}${modeParam}`;
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
    connect('create', randomCode(), name, selectedMode);
  });

  btnJoin.addEventListener('click', () => {
    const name = (nameInput.value || 'لاعب').trim().slice(0, 12) || 'لاعب';
    const code = (codeInput.value || '').trim();
    if (!/^[0-9]{4}$/.test(code)) {
      homeError.textContent = 'أدخل رمز غرفة مكوّن من 4 أرقام';
      return;
    }
    localStorage.setItem('tron_name', name);
    connect('join', code, name);
  });

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/[^0-9]/g, '').slice(0, 4);
  });

  btnStart.addEventListener('click', () => send({ type: 'start' }));
  btnRestart.addEventListener('click', () => send({ type: 'restart' }));

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400);
  }

  function handleMessage(ev) {
    const msg = JSON.parse(ev.data);
    gotResponse = true;

    if (msg.type === 'error') {
      if (msg.code === 'CODE_TAKEN' && createRetriesLeft > 0) {
        createRetriesLeft--;
        const name = (nameInput.value || 'لاعب').trim().slice(0, 12) || 'لاعب';
        connect('create', randomCode(), name, selectedMode);
        return;
      }
      homeError.textContent = msg.message;
      showScreen('home');
    }

    if (msg.type === 'created' || msg.type === 'joined') {
      myId = msg.playerId;
      roomCode = msg.code;
      currentMode = msg.mode || 'tron';
      showScreen('lobby');
      roomCodeEl.textContent = msg.code;
    }

    if (msg.type === 'lobby') {
      roomCode = msg.code;
      currentMode = msg.mode || currentMode;
      roomCodeEl.textContent = msg.code;
      lobbyModeHint.textContent = currentMode === 'coop'
        ? '💎 غزو الجواهر — تعاونوا لجمع النقاط (يمكن البدء بلاعب واحد)'
        : '🏍️ دراجات الضوء — آخر ناجٍ يفوز (يلزم لاعبان على الأقل)';
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
      btnStart.disabled = currentMode === 'coop' ? false : msg.players.length < 2;
      showScreen('lobby');
    }

    if (msg.type === 'start') {
      currentMode = msg.mode || currentMode;
      grid = msg.grid;
      currentTickMs = msg.tickMs || BASE_TICK_MS;
      players = new Map();
      msg.players.forEach((p) => {
        players.set(p.id, {
          name: p.name,
          color: p.color,
          alive: true,
          down: false,
          dir: p.dir,
          x: p.x,
          y: p.y,
          prevX: p.x,
          prevY: p.y,
          lastTick: performance.now(),
        });
      });
      coins = msg.coins || [];
      obstacles = msg.obstacles || [];
      coopScore = msg.score || 0;
      coopLives = msg.lives || 0;
      coopLevel = msg.level || 1;
      coopHud.classList.toggle('hidden', currentMode !== 'coop');
      updateCoopHud();
      setupCanvas();
      overlay.classList.add('hidden');
      showScreen('game');
      renderHud();
    }

    if (msg.type === 'tick') {
      const now = performance.now();
      if (msg.tickMs) currentTickMs = msg.tickMs;
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
        if ('alive' in ev) p.alive = ev.alive;
        if ('down' in ev) p.down = ev.down;
        if (ev.dir) p.dir = ev.dir;
        p.lastTick = now;
      });
      if (currentMode === 'coop') {
        coins = msg.coins || coins;
        obstacles = msg.obstacles || obstacles;
        coopScore = msg.score;
        coopLives = msg.lives;
        coopLevel = msg.level;
        updateCoopHud();
      }
      renderHud();
    }

    if (msg.type === 'levelup') {
      showToast(`🎉 المستوى ${msg.level}!`);
    }

    if (msg.type === 'gameover') {
      if (currentMode === 'coop') {
        overlayTitle.innerHTML = `🛰️ انتهت المهمة — <span style="color:#ffd740">${msg.score} جوهرة</span> عند المستوى ${msg.level}`;
      } else if (msg.winner) {
        overlayTitle.innerHTML = `🏆 فاز <span style="color:${msg.winner.color}">${escapeHtml(msg.winner.name)}</span>`;
      } else {
        overlayTitle.textContent = 'تعادل! لا يوجد فائز';
      }
      btnRestart.classList.toggle('hidden', !isHost);
      overlayHint.textContent = isHost ? '' : 'بانتظار المضيف لبدء جولة جديدة…';
      overlay.classList.remove('hidden');
    }
  }

  function updateCoopHud() {
    coopScoreEl.textContent = coopScore;
    coopLivesEl.textContent = coopLives;
    coopLevelEl.textContent = coopLevel;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderHud() {
    hud.innerHTML = '';
    players.forEach((p) => {
      const okay = currentMode === 'coop' ? !p.down : p.alive;
      const chip = document.createElement('div');
      chip.className = 'chip' + (okay ? '' : ' dead');
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

    stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * availW,
      y: Math.random() * availH,
      r: Math.random() * 1.4 + 0.3,
      tw: Math.random() * 6.28,
    }));
  }

  window.addEventListener('resize', () => {
    if (screens.game.classList.contains('active')) setupCanvas();
  });

  function drawTrailCell(x, y, color) {
    trailCtx.fillStyle = color;
    trailCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }

  const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

  function frame() {
    requestAnimationFrame(frame);
    if (!screens.game.classList.contains('active')) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const now = performance.now();

    if (currentMode === 'coop') {
      renderCoopFrame(w, h, now);
    } else {
      renderTronFrame(w, h, now);
    }
  }
  requestAnimationFrame(frame);

  function renderTronFrame(w, h, now) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    const ox = canvas.offsetXPx || 0;
    const oy = canvas.offsetYPx || 0;

    ctx.drawImage(trailLayer, ox, oy);

    ctx.strokeStyle = 'rgba(64,196,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, cellSize * grid.w, cellSize * grid.h);

    players.forEach((p) => {
      if (!p.alive) return;
      const t = Math.min(1, (now - p.lastTick) / currentTickMs);
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

  function renderCoopFrame(w, h, now) {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#100a24');
    grad.addColorStop(1, '#1a0f33');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    stars.forEach((s) => {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(now / 600 + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    const ox = canvas.offsetXPx || 0;
    const oy = canvas.offsetYPx || 0;

    ctx.strokeStyle = 'rgba(224,64,251,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, cellSize * grid.w, cellSize * grid.h);

    // جواهر
    coins.forEach((c) => {
      const pulse = 0.75 + 0.25 * Math.sin(now / 180 + c.x + c.y);
      const cx = ox + c.x * cellSize + cellSize / 2;
      const cy = oy + c.y * cellSize + cellSize / 2;
      const s = cellSize * 0.32 * pulse;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.shadowColor = '#ffd740';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffd740';
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    });

    // كويكبات
    obstacles.forEach((o, i) => {
      const cx = ox + o.x * cellSize + cellSize / 2;
      const cy = oy + o.y * cellSize + cellSize / 2;
      const s = cellSize * 0.4;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(now / 900 + i);
      ctx.shadowColor = '#ff6e40';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#4a3a3a';
      ctx.strokeStyle = '#ff6e40';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    });

    // السفن
    players.forEach((p) => {
      const t = Math.min(1, (now - p.lastTick) / currentTickMs);
      const px = p.prevX + (p.x - p.prevX) * t;
      const py = p.prevY + (p.y - p.prevY) * t;
      const cx = ox + px * cellSize + cellSize / 2;
      const cy = oy + py * cellSize + cellSize / 2;
      const s = cellSize * 0.46;

      ctx.save();
      ctx.globalAlpha = p.down ? 0.35 : 1;
      ctx.translate(cx, cy);
      ctx.rotate(DIR_ANGLE[p.dir] || 0);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s, s * 0.75);
      ctx.lineTo(-s * 0.4, 0);
      ctx.lineTo(-s, -s * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

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
  setInterval(() => { lastSentDir = null; }, BASE_TICK_MS);

  if ('serviceWorker' in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
