(() => {
  const BASE_TICK_MS = 110;
  const CATS_TICK_MS = 33;
  let currentTickMs = BASE_TICK_MS;

  // فيزياء محلية متطابقة مع الخادم لتوقّع حركة قطة اللاعب نفسه فورًا
  // (يخفي زمن الشبكة عند القفز)، بينما يبقى الخادم مرجع الحقيقة دائمًا
  const CATS_GRAVITY = 1;
  const CATS_JUMP_V = -16;
  const CATS_MOVE_SPEED = 5;
  const CATS_MAX_FALL = 18;
  const CATS_BOUNCE_V = -25;
  const CATS_ICE_ACCEL = 0.15;
  const CATS_CRUMBLE_DELAY_CLIENT = 20;
  const CAT_W = 30;
  const CAT_H = 30;
  const localPred = { x: 0, y: 0, vx: 0, vy: 0, grounded: false, standingType: null, trapped: false };
  let predAccum = 0;
  let predLastNow = 0;

  function aabbOverlapLocal(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function localCatsStep() {
    let newX = localPred.x + localPred.vx;
    const rectX = { x: newX, y: localPred.y, w: CAT_W, h: CAT_H };
    for (const pl of catsPlatforms) {
      if (pl.broken) continue;
      if (aabbOverlapLocal(rectX, pl)) {
        if (localPred.vx > 0) newX = pl.x - CAT_W;
        else if (localPred.vx < 0) newX = pl.x + pl.w;
        localPred.vx = 0;
      }
    }
    localPred.x = Math.max(0, Math.min(catsWorld.w - CAT_W, newX));

    let newY = localPred.y + localPred.vy;
    const rectY = { x: localPred.x, y: newY, w: CAT_W, h: CAT_H };
    let grounded = false;
    let standingType = null;
    for (const pl of catsPlatforms) {
      if (pl.broken) continue;
      if (aabbOverlapLocal(rectY, pl)) {
        if (localPred.vy > 0) { newY = pl.y - CAT_H; grounded = true; standingType = pl.type; }
        else if (localPred.vy < 0) { newY = pl.y + pl.h; }
        localPred.vy = 0;
      }
    }
    localPred.y = newY;
    localPred.grounded = grounded;
    if (standingType === 'bounce') {
      localPred.vy = CATS_BOUNCE_V;
      localPred.grounded = false;
    }
    localPred.standingType = standingType;
  }

  function stepLocalPrediction(now) {
    if (predLastNow === 0) { predLastNow = now; return; }
    predAccum += now - predLastNow;
    predLastNow = now;
    if (localPred.trapped) { predAccum = 0; return; }
    let steps = 0;
    while (predAccum >= CATS_TICK_MS && steps < 5) {
      const targetVx = (heldRight && !heldLeft ? 1 : heldLeft && !heldRight ? -1 : 0) * CATS_MOVE_SPEED;
      if (localPred.standingType === 'ice') localPred.vx += (targetVx - localPred.vx) * CATS_ICE_ACCEL;
      else localPred.vx = targetVx;
      localPred.vy = Math.min(localPred.vy + CATS_GRAVITY, CATS_MAX_FALL);
      localCatsStep();
      predAccum -= CATS_TICK_MS;
      steps++;
    }
  }

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
  const catsHud = document.getElementById('cats-hud');
  const catsScoreEl = document.getElementById('cats-score');
  const catsTotalEl = document.getElementById('cats-total');
  const catsTimeEl = document.getElementById('cats-time');
  const toastEl = document.getElementById('toast');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayHint = document.getElementById('overlay-hint');
  const btnRestart = document.getElementById('btn-restart');
  const padUp = document.getElementById('pad-up');
  const padDown = document.getElementById('pad-down');
  const padPull = document.getElementById('pad-pull');
  const musicToggle = document.getElementById('music-toggle');

  const MODE_INFO = {
    tron: { subtitle: 'لعبة سريعة متعددة اللاعبين — عالم أكبر، دروع، ومنطقة تضيق كلما طال القتال!' },
    coop: { subtitle: 'تعاونوا كطاقم فضائي واحد لجمع الجواهر والهروب من الكويكبات والمسيّرات!' },
    cats: { subtitle: 'قطط مربوطة بحبل واحد — تعاونوا لعبور المنصات معًا دون أن يسقط أحد!' },
  };

  let selectedMode = 'tron';
  modeSelect.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      selectedMode = card.dataset.mode;
      modeSelect.querySelectorAll('.mode-card').forEach((c) => c.classList.toggle('active', c === card));
      document.getElementById('home-subtitle').textContent = MODE_INFO[selectedMode].subtitle;
      setMusicMood(selectedMode);
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
  let starsFar = [];

  // تنافسي: دراجات الضوء
  let powerups = [];
  let arenaInset = 0;

  // تعاوني: غزو الجواهر
  let coins = [];
  let obstacles = [];
  let drones = [];
  let shieldPickup = null;
  let coopScore = 0;
  let coopLives = 0;
  let coopLevel = 1;
  let toastTimer = null;

  // تعاوني: القطط المربوطة
  let catsWorld = { w: 2600, h: 760 };
  let catsPlatforms = [];
  let catsSpikes = [];
  let catsWindzones = [];
  let catsCheckpoints = [];
  let catsFinishX = 0;
  let catsYarns = [];
  let catsScore = 0;
  let catsCombo = 0;
  let catsStartTs = 0;
  let catsFinalTimeMs = null;
  let camX = 0, camY = 0;
  let screenShake = 0;
  let pulling = false;

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

  const MODE_LABELS = {
    tron: '🏍️ دراجات الضوء — آخر ناجٍ يفوز، والمنطقة تضيق مع الوقت (يلزم لاعبان على الأقل)',
    coop: '💎 غزو الجواهر — تعاونوا لجمع النقاط وتفادي المسيّرات (يمكن البدء بلاعب واحد)',
    cats: '🐱 القطط المربوطة — اعبروا المضمار معًا دون أن يسقط أحدكم (يمكن البدء بلاعب واحد)',
  };

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
      lobbyModeHint.textContent = MODE_LABELS[currentMode] || '';
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
      btnStart.disabled = currentMode === 'tron' ? msg.players.length < 2 : false;
      showScreen('lobby');
    }

    if (msg.type === 'start') {
      currentMode = msg.mode || currentMode;
      resetHeldMoveState();
      padDown.classList.toggle('hidden', currentMode === 'cats');
      padPull.classList.toggle('hidden', currentMode !== 'cats');
      padUp.textContent = currentMode === 'cats' ? '⤴' : '▲';
      setMusicMood(currentMode);

      if (currentMode === 'cats') {
        catsWorld = msg.world;
        catsPlatforms = msg.platforms;
        catsSpikes = msg.spikes;
        catsWindzones = msg.windzones || [];
        catsCheckpoints = msg.checkpoints;
        catsFinishX = msg.finishX;
        catsYarns = msg.yarns || [];
        catsScore = msg.score || 0;
        catsCombo = 0;
        catsFinalTimeMs = null;
        catsStartTs = performance.now();
        currentTickMs = CATS_TICK_MS;
        pulling = false;
        screenShake = 0;
        players = new Map();
        msg.players.forEach((p) => {
          players.set(p.id, {
            name: p.name, color: p.color, facing: p.facing || 'right', grounded: false, trapped: false,
            x: p.x, y: p.y, prevX: p.x, prevY: p.y, lastTick: performance.now(),
          });
        });
        catsTotalEl.textContent = catsYarns.length + catsScore;
        catsScoreEl.textContent = catsScore;
        catsTimeEl.textContent = '0.0';
        const me = msg.players.find((p) => p.id === myId);
        if (me) {
          localPred.x = me.x; localPred.y = me.y; localPred.vx = 0; localPred.vy = 0; localPred.grounded = false;
          localPred.trapped = false; localPred.standingType = null;
        }
        predAccum = 0; predLastNow = 0;
      } else {
        grid = msg.grid;
        currentTickMs = msg.tickMs || BASE_TICK_MS;
        players = new Map();
        msg.players.forEach((p) => {
          players.set(p.id, {
            name: p.name, color: p.color, alive: true, down: false, shield: false, dir: p.dir,
            x: p.x, y: p.y, prevX: p.x, prevY: p.y, lastTick: performance.now(),
          });
        });
        powerups = msg.powerups || [];
        arenaInset = msg.inset || 0;
        coins = msg.coins || [];
        obstacles = msg.obstacles || [];
        drones = msg.drones || [];
        shieldPickup = msg.shieldPickup || null;
        coopScore = msg.score || 0;
        coopLives = msg.lives || 0;
        coopLevel = msg.level || 1;
      }

      coopHud.classList.toggle('hidden', currentMode !== 'coop');
      catsHud.classList.toggle('hidden', currentMode !== 'cats');
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
        if (ev.trailCell) drawTrailCell(ev.trailCell.x, ev.trailCell.y, p.color);
        p.prevX = p.x;
        p.prevY = p.y;
        p.x = ev.x;
        p.y = ev.y;
        if ('alive' in ev) p.alive = ev.alive;
        if ('down' in ev) p.down = ev.down;
        if ('shield' in ev) p.shield = ev.shield;
        if (ev.dir) p.dir = ev.dir;
        if (ev.facing) p.facing = ev.facing;
        if ('grounded' in ev) p.grounded = ev.grounded;
        if ('trapped' in ev) p.trapped = ev.trapped;
        if (ev.impact) screenShake = 8;
        p.lastTick = now;

        if (currentMode === 'cats' && ev.id === myId) {
          localPred.trapped = !!ev.trapped;
          if (!localPred.trapped) {
            const dist = Math.hypot(ev.x - localPred.x, ev.y - localPred.y);
            if (dist > 60) {
              localPred.x = ev.x; localPred.y = ev.y; localPred.vy = 0;
            } else {
              localPred.x += (ev.x - localPred.x) * 0.15;
              localPred.y += (ev.y - localPred.y) * 0.15;
            }
          } else {
            localPred.x = ev.x; localPred.y = ev.y; localPred.vx = 0; localPred.vy = 0;
          }
          localPred.grounded = ev.grounded;
        }
      });
      if (currentMode === 'tron') {
        powerups = msg.powerups || powerups;
        arenaInset = msg.inset || 0;
      } else if (currentMode === 'coop') {
        coins = msg.coins || coins;
        obstacles = msg.obstacles || obstacles;
        drones = msg.drones || drones;
        shieldPickup = 'shieldPickup' in msg ? msg.shieldPickup : shieldPickup;
        coopScore = msg.score;
        coopLives = msg.lives;
        coopLevel = msg.level;
        updateCoopHud();
      } else if (currentMode === 'cats') {
        catsYarns = msg.yarns || catsYarns;
        if (msg.platformUpdates) {
          for (const u of msg.platformUpdates) {
            const pl = catsPlatforms[u.i];
            if (pl) { pl.x = u.x; pl.y = u.y; pl.broken = u.broken; pl.standTicks = u.standTicks; }
          }
        }
        if (msg.score > catsScore && msg.combo > 1) showToast(`🧶 سلسلة x${msg.combo}!`);
        catsScore = msg.score;
        catsCombo = msg.combo || 0;
        catsScoreEl.textContent = catsScore;
      }
      renderHud();
    }

    if (msg.type === 'levelup') showToast(`🎉 المستوى ${msg.level}!`);
    if (msg.type === 'checkpoint') showToast('🚩 نقطة تفتيش!');
    if (msg.type === 'hazard') showToast('💥 أُعدتم لآخر نقطة تفتيش!');
    if (msg.type === 'rescue') {
      showToast(msg.success ? '🤝 تم الإنقاذ!' : '😿 سحبكم الوزن للحفرة!');
      screenShake = msg.success ? 4 : 10;
    }

    if (msg.type === 'gameover') {
      if (currentMode === 'cats') {
        catsFinalTimeMs = msg.timeMs;
        const seconds = (msg.timeMs / 1000).toFixed(1);
        const stars = '⭐'.repeat(msg.stars || 1) + '☆'.repeat(3 - (msg.stars || 1));
        overlayTitle.innerHTML = `🎉 وصلتم معًا! <span style="color:#ffd740">${msg.score}/${msg.totalYarns} 🧶</span> في ${seconds} ثانية<br><span style="font-size:1.4rem">${stars}</span>`;
      } else if (currentMode === 'coop') {
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
      const okay = currentMode === 'tron' ? p.alive : currentMode === 'coop' ? !p.down : true;
      const chip = document.createElement('div');
      chip.className = 'chip' + (okay ? '' : ' dead') + (p.shield ? ' shielded' : '');
      chip.innerHTML = `<span class="dot" style="background:${p.color}"></span>${escapeHtml(p.name)}${p.shield ? ' 🛡️' : ''}`;
      hud.appendChild(chip);
    });
  }

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const availW = canvas.clientWidth || window.innerWidth;
    const availH = canvas.clientHeight || window.innerHeight;

    canvas.width = availW * dpr;
    canvas.height = availH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (currentMode === 'cats') {
      starsFar = Array.from({ length: 8 }, () => ({ x: Math.random() * (catsWorld.w + availW), y: 40 + Math.random() * 140, r: 30 + Math.random() * 40 }));
      canvas.offsetXPx = 0;
      canvas.offsetYPx = 0;
      return;
    }

    cellSize = Math.floor(Math.min(availW / grid.w, availH / grid.h));
    const pixelW = cellSize * grid.w;
    const pixelH = cellSize * grid.h;

    trailLayer.width = pixelW;
    trailLayer.height = pixelH;
    trailCtx.clearRect(0, 0, pixelW, pixelH);

    canvas.offsetXPx = Math.floor((availW - pixelW) / 2);
    canvas.offsetYPx = Math.floor((availH - pixelH) / 2);

    stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * availW, y: Math.random() * availH, r: Math.random() * 1.4 + 0.3, tw: Math.random() * 6.28,
    }));
    starsFar = Array.from({ length: 40 }, () => ({
      x: Math.random() * availW, y: Math.random() * availH, r: Math.random() * 1 + 0.2, tw: Math.random() * 6.28,
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

    if (currentMode === 'coop') renderCoopFrame(w, h, now);
    else if (currentMode === 'cats') { stepLocalPrediction(now); renderCatsFrame(w, h, now); }
    else renderTronFrame(w, h, now);
  }
  requestAnimationFrame(frame);

  function renderTronFrame(w, h, now) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    const ox = canvas.offsetXPx || 0;
    const oy = canvas.offsetYPx || 0;
    const pulse = 0.08 + 0.05 * Math.sin(now / 700);

    ctx.strokeStyle = `rgba(64,196,255,${pulse.toFixed(2)})`;
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= grid.w; gx += 4) {
      ctx.beginPath(); ctx.moveTo(ox + gx * cellSize, oy); ctx.lineTo(ox + gx * cellSize, oy + grid.h * cellSize); ctx.stroke();
    }
    for (let gy = 0; gy <= grid.h; gy += 4) {
      ctx.beginPath(); ctx.moveTo(ox, oy + gy * cellSize); ctx.lineTo(ox + grid.w * cellSize, oy + gy * cellSize); ctx.stroke();
    }

    ctx.drawImage(trailLayer, ox, oy);

    ctx.strokeStyle = 'rgba(64,196,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, cellSize * grid.w, cellSize * grid.h);

    if (arenaInset > 0) {
      ctx.strokeStyle = `rgba(255,82,82,${0.5 + 0.3 * Math.abs(Math.sin(now / 300))})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        ox + arenaInset * cellSize, oy + arenaInset * cellSize,
        (grid.w - arenaInset * 2) * cellSize, (grid.h - arenaInset * 2) * cellSize
      );
    }

    powerups.forEach((pu) => {
      const cx = ox + pu.x * cellSize + cellSize / 2;
      const cy = oy + pu.y * cellSize + cellSize / 2;
      const pulse2 = 0.8 + 0.2 * Math.sin(now / 200);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.shadowColor = '#69f0ae';
      ctx.shadowBlur = 12 * pulse2;
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(a) * cellSize * 0.4 * pulse2;
        const py = Math.sin(a) * cellSize * 0.4 * pulse2;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

    players.forEach((p) => {
      if (!p.alive) return;
      const t = Math.min(1, (now - p.lastTick) / currentTickMs);
      const px = p.prevX + (p.x - p.prevX) * t;
      const py = p.prevY + (p.y - p.prevY) * t;
      const cx = ox + px * cellSize + cellSize / 2;
      const cy = oy + py * cellSize + cellSize / 2;

      if (p.shield) {
        ctx.save();
        ctx.strokeStyle = '#69f0ae';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 150);
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(DIR_ANGLE[p.dir] || 0);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.color;
      const s = cellSize * 0.5;
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.6, s * 0.6);
      ctx.lineTo(-s * 0.6, -s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function renderCoopFrame(w, h, now) {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const hueShift = 6 * Math.sin(now / 4000);
    grad.addColorStop(0, `hsl(${255 + hueShift},55%,10%)`);
    grad.addColorStop(1, `hsl(${280 + hueShift},60%,14%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    starsFar.forEach((s) => {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    stars.forEach((s) => {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(now / 600 + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });

    const ox = canvas.offsetXPx || 0;
    const oy = canvas.offsetYPx || 0;

    ctx.strokeStyle = 'rgba(224,64,251,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, cellSize * grid.w, cellSize * grid.h);

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

    if (shieldPickup) {
      const cx = ox + shieldPickup.x * cellSize + cellSize / 2;
      const cy = oy + shieldPickup.y * cellSize + cellSize / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(now / 500);
      ctx.strokeStyle = '#69f0ae';
      ctx.shadowColor = '#69f0ae';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * cellSize * 0.4;
        const py = Math.sin(a) * cellSize * 0.4;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

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

    drones.forEach((d) => {
      const cx = ox + d.x * cellSize + cellSize / 2;
      const cy = oy + d.y * cellSize + cellSize / 2;
      const s = cellSize * 0.4;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.shadowColor = '#ff5252';
      ctx.shadowBlur = 10 + 4 * Math.sin(now / 150);
      ctx.fillStyle = '#2a0f14';
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff5252';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    players.forEach((p) => {
      const t = Math.min(1, (now - p.lastTick) / currentTickMs);
      const px = p.prevX + (p.x - p.prevX) * t;
      const py = p.prevY + (p.y - p.prevY) * t;
      const cx = ox + px * cellSize + cellSize / 2;
      const cy = oy + py * cellSize + cellSize / 2;
      const s = cellSize * 0.46;

      if (p.shield) {
        ctx.save();
        ctx.strokeStyle = '#69f0ae';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 150);
        ctx.beginPath();
        ctx.arc(cx, cy, s * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

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

  function catsCentroid(renderPos) {
    let sx = 0, sy = 0, n = 0;
    renderPos.forEach((p) => { sx += p.x; sy += p.y; n++; });
    if (n === 0) return { x: 0, y: 500 };
    return { x: sx / n, y: sy / n };
  }

  function drawCat(x, y, color, facing, down, trapped, now) {
    const w = 30, h = 30;
    const shake = trapped ? Math.sin((now || 0) / 60) * 2 : 0;
    const cx = x + w / 2 + shake, cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (facing === 'left') ctx.scale(-1, 1);
    ctx.globalAlpha = down ? 0.5 : 1;
    // ذيل
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, 2);
    ctx.quadraticCurveTo(-w / 2 - 12, -6, -w / 2 - 6, -16);
    ctx.stroke();
    // جسم
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // أذنان
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 4, -h / 2 + 6);
    ctx.lineTo(-w / 2 + 10, -h / 2 - 8);
    ctx.lineTo(-w / 2 + 16, -h / 2 + 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 16, -h / 2 + 6);
    ctx.lineTo(w / 2 - 10, -h / 2 - 8);
    ctx.lineTo(w / 2 - 4, -h / 2 + 6);
    ctx.closePath();
    ctx.fill();
    // عينان
    ctx.fillStyle = '#0b0f1a';
    ctx.beginPath(); ctx.arc(5, -1, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -1, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (trapped) {
      ctx.save();
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#ffd740';
      ctx.textAlign = 'center';
      ctx.fillText('!', cx, cy - h);
      ctx.restore();
    }
  }

  function catsRenderPositions(now) {
    const pos = new Map();
    players.forEach((p, id) => {
      if (id === myId) {
        const facing = heldLeft && !heldRight ? 'left' : heldRight && !heldLeft ? 'right' : p.facing;
        pos.set(id, { x: localPred.x, y: localPred.y, color: p.color, facing, trapped: p.trapped });
      } else {
        const t = Math.min(1, (now - p.lastTick) / currentTickMs);
        pos.set(id, { x: p.prevX + (p.x - p.prevX) * t, y: p.prevY + (p.y - p.prevY) * t, color: p.color, facing: p.facing, trapped: p.trapped });
      }
    });
    return pos;
  }

  function renderCatsFrame(w, h, now) {
    const renderPos = catsRenderPositions(now);
    const centroid = catsCentroid(renderPos);
    const targetCamX = Math.max(0, Math.min(catsWorld.w - w, centroid.x - w / 2));
    const targetCamY = Math.max(0, Math.min(Math.max(0, catsWorld.h - h), centroid.y - h / 2));
    camX += (targetCamX - camX) * 0.08;
    camY += (targetCamY - camY) * 0.08;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#7ec8f2');
    grad.addColorStop(1, '#cdeaff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    starsFar.forEach((c) => {
      const sx = c.x - camX * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(sx, c.y, c.r, c.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    if (screenShake > 0) screenShake = Math.max(0, screenShake - 0.5);

    ctx.save();
    ctx.translate(-camX + shakeX, -camY + shakeY);

    catsCheckpoints.forEach((cp) => {
      const px = cp.x + cp.w / 2;
      ctx.strokeStyle = '#8a93a8';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px, cp.y + cp.h); ctx.lineTo(px, cp.y + cp.h - 90); ctx.stroke();
      ctx.fillStyle = 'rgba(105,240,174,0.6)';
      ctx.beginPath();
      ctx.moveTo(px, cp.y + cp.h - 90);
      ctx.lineTo(px + 22, cp.y + cp.h - 82);
      ctx.lineTo(px, cp.y + cp.h - 74);
      ctx.closePath();
      ctx.fill();
    });

    catsWindzones.forEach((wz) => {
      for (let i = 0; i < 10; i++) {
        const t = ((now / 400 + i / 10) % 1);
        const wx = wz.x + t * wz.w;
        const wy = wz.y + (i * 37 % wz.h);
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.15 * Math.sin(now / 200 + i)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.sin(now / 300 + i) * 26 + 20, wy);
        ctx.stroke();
      }
    });

    catsPlatforms.forEach((pl) => {
      if (pl.broken) return;
      if (pl.type === 'pitfloor') {
        ctx.fillStyle = '#3a1015';
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        ctx.fillStyle = '#ff6e40';
        ctx.fillRect(pl.x, pl.y, pl.w, 4);
        return;
      }
      if (pl.type === 'moving') {
        ctx.fillStyle = '#2f3a6b';
        ctx.fillRect(pl.x, pl.y, pl.w, Math.min(pl.h, 26));
        ctx.fillStyle = '#40c4ff';
        ctx.fillRect(pl.x, pl.y, pl.w, 6);
        return;
      }
      if (pl.type === 'crumble') {
        const wear = Math.min(1, (pl.standTicks || 0) / CATS_CRUMBLE_DELAY_CLIENT);
        ctx.fillStyle = `rgb(${140 + wear * 90},${90 - wear * 40},${50 - wear * 30})`;
        ctx.fillRect(pl.x, pl.y, pl.w, Math.min(pl.h, 26));
        if (wear > 0.3) {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pl.x + pl.w * 0.3, pl.y);
          ctx.lineTo(pl.x + pl.w * 0.5, pl.y + Math.min(pl.h, 26));
          ctx.moveTo(pl.x + pl.w * 0.7, pl.y);
          ctx.lineTo(pl.x + pl.w * 0.55, pl.y + Math.min(pl.h, 26));
          ctx.stroke();
        }
        return;
      }
      if (pl.type === 'bounce') {
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        ctx.strokeStyle = '#69f0ae';
        ctx.lineWidth = 2;
        for (let sx = pl.x + 6; sx < pl.x + pl.w - 4; sx += 12) {
          ctx.beginPath();
          ctx.moveTo(sx, pl.y + pl.h);
          ctx.lineTo(sx + 6, pl.y + 4);
          ctx.stroke();
        }
        return;
      }
      if (pl.type === 'ice') {
        ctx.fillStyle = '#4a6b7a';
        ctx.fillRect(pl.x, pl.y, pl.w, Math.min(pl.h, 60));
        const grad = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + 16);
        grad.addColorStop(0, '#e0f7ff');
        grad.addColorStop(1, '#8ecfe0');
        ctx.fillStyle = grad;
        ctx.fillRect(pl.x, pl.y, pl.w, 12);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        for (let sx = pl.x + 10; sx < pl.x + pl.w; sx += 26) {
          ctx.beginPath(); ctx.moveTo(sx, pl.y + 2); ctx.lineTo(sx + 8, pl.y + 10); ctx.stroke();
        }
        return;
      }
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(pl.x, pl.y, pl.w, Math.min(pl.h, 60));
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(pl.x, pl.y, pl.w, 10);
      ctx.fillStyle = '#69f0ae';
      for (let gx = pl.x + 6; gx < pl.x + pl.w - 4; gx += 14) {
        ctx.fillRect(gx, pl.y - 3, 4, 8);
      }
    });

    catsSpikes.forEach((s) => {
      ctx.fillStyle = '#e0405180';
      const count = Math.max(1, Math.floor(s.w / 14));
      const step = s.w / count;
      ctx.fillStyle = '#c62828';
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.moveTo(s.x + i * step, s.y + s.h);
        ctx.lineTo(s.x + i * step + step / 2, s.y);
        ctx.lineTo(s.x + i * step + step, s.y + s.h);
        ctx.closePath();
        ctx.fill();
      }
    });

    catsYarns.forEach((y) => {
      const bob = Math.sin(now / 300 + y.x) * 4;
      ctx.save();
      ctx.translate(y.x, y.y + bob);
      ctx.fillStyle = '#e040fb';
      ctx.shadowColor = '#e040fb';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0.3, 2.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 8, 2, 4.5); ctx.stroke();
      ctx.restore();
    });

    // علم النهاية
    ctx.strokeStyle = '#8a93a8';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(catsFinishX, 560); ctx.lineTo(catsFinishX, 460); ctx.stroke();
    ctx.fillStyle = '#40c4ff';
    ctx.fillRect(catsFinishX, 460, 30, 20);
    ctx.fillStyle = '#e8edf7';
    ctx.fillRect(catsFinishX, 460, 15, 10);
    ctx.fillRect(catsFinishX + 15, 470, 15, 10);

    // الحبل
    const ids = [...players.keys()];
    ctx.strokeStyle = '#8a5a2f';
    ctx.lineWidth = 3;
    for (let i = 0; i < ids.length - 1; i++) {
      const a = renderPos.get(ids[i]);
      const b = renderPos.get(ids[i + 1]);
      const ax = a.x + 15, ay = a.y + 15;
      const bx = b.x + 15, by = b.y + 15;
      const midX = (ax + bx) / 2;
      const midY = (ay + by) / 2 + 14;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(midX, midY, bx, by);
      ctx.stroke();
    }

    renderPos.forEach((p) => {
      drawCat(p.x, p.y, p.color, p.facing, false, p.trapped, now);
    });

    ctx.restore();

    if (screens.game.classList.contains('active') && catsFinalTimeMs === null) {
      catsTimeEl.textContent = ((performance.now() - catsStartTs) / 1000).toFixed(1);
    }
  }

  // ---- controls ----
  let lastSentDir = null;
  function sendDir(dir) {
    if (dir === lastSentDir) return;
    lastSentDir = dir;
    send({ type: 'dir', dir });
  }

  let heldLeft = false, heldRight = false, lastMoveSent = 'none';
  function resetHeldMoveState() {
    heldLeft = false; heldRight = false; lastMoveSent = 'none';
  }
  function updateCatsMove() {
    const dir = heldRight && !heldLeft ? 'right' : heldLeft && !heldRight ? 'left' : 'none';
    if (dir !== lastMoveSent) {
      lastMoveSent = dir;
      send({ type: 'move', dir });
    }
  }
  function sendJump() {
    if (currentMode === 'cats' && localPred.grounded) {
      localPred.vy = CATS_JUMP_V;
      localPred.grounded = false;
    }
    send({ type: 'jump' });
  }
  function setPulling(held) {
    if (pulling === held) return;
    pulling = held;
    padPull.classList.toggle('active-hold', held);
    send({ type: 'pull', held });
  }

  const keyMap = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) { toggleMusic(); return; }
    if (currentMode === 'cats') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); heldLeft = true; updateCatsMove(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); heldRight = true; updateCatsMove(); }
      else if (!e.repeat && (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space')) { e.preventDefault(); sendJump(); }
      else if (e.code === 'KeyE') { e.preventDefault(); setPulling(true); }
      return;
    }
    const dir = keyMap[e.code];
    if (dir) {
      e.preventDefault();
      sendDir(dir);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (currentMode !== 'cats') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { heldLeft = false; updateCatsMove(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { heldRight = false; updateCatsMove(); }
    else if (e.code === 'KeyE') { setPulling(false); }
  });

  document.querySelectorAll('.pad-btn').forEach((btn) => {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (currentMode === 'cats') {
        if (dir === 'left') { heldLeft = true; updateCatsMove(); }
        else if (dir === 'right') { heldRight = true; updateCatsMove(); }
        else if (dir === 'up') sendJump();
        return;
      }
      sendDir(dir);
    });
    const release = () => {
      if (currentMode !== 'cats') return;
      if (dir === 'left') { heldLeft = false; updateCatsMove(); }
      else if (dir === 'right') { heldRight = false; updateCatsMove(); }
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  });
  window.addEventListener('pointerup', () => { if (currentMode === 'cats') { heldLeft = false; heldRight = false; updateCatsMove(); } });

  padPull.addEventListener('pointerdown', (e) => { e.preventDefault(); setPulling(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => padPull.addEventListener(ev, () => setPulling(false)));

  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    if (currentMode === 'cats') return;
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (currentMode === 'cats' || !touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) sendDir(dx > 0 ? 'right' : 'left');
    else sendDir(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  setInterval(() => { lastSentDir = null; }, BASE_TICK_MS);

  // ---- الموسيقى الخلفية (مولّدة إجرائيًا، بلا ملفات صوتية خارجية) ----
  const MUSIC_KEY = 'tron_music_on';
  let musicOn = localStorage.getItem(MUSIC_KEY) === '1';
  let audioCtx = null;
  let musicGain = null;
  let musicTimer = null;
  let musicMood = 'home';
  let musicStep = 0;

  const MUSIC_MOODS = {
    home: { tempo: 480, bassSemi: -19, scale: [0, 3, 5, 7, 10], filter: 1200, wave: 'triangle' },
    tron: { tempo: 210, bassSemi: -31, scale: [0, 3, 5, 7, 8, 10], filter: 2400, wave: 'sawtooth' },
    coop: { tempo: 300, bassSemi: -23, scale: [0, 2, 4, 7, 9], filter: 1900, wave: 'square' },
    cats: { tempo: 260, bassSemi: -27, scale: [0, 2, 3, 5, 7, 9, 10], filter: 2000, wave: 'triangle' },
  };

  function noteFreq(semitones) {
    return 220 * Math.pow(2, semitones / 12);
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = audioCtx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playMusicStep() {
    if (!musicOn || !audioCtx) return;
    const mood = MUSIC_MOODS[musicMood] || MUSIC_MOODS.home;
    const now = audioCtx.currentTime;

    const bassOsc = audioCtx.createOscillator();
    const bassGain = audioCtx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.value = noteFreq(mood.bassSemi);
    bassGain.gain.setValueAtTime(0.22, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    bassOsc.connect(bassGain).connect(musicGain);
    bassOsc.start(now); bassOsc.stop(now + 0.25);

    const degree = mood.scale[musicStep % mood.scale.length];
    const octave = Math.floor(musicStep / mood.scale.length) % 2 === 0 ? 0 : 12;
    const leadOsc = audioCtx.createOscillator();
    const leadGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood.filter;
    leadOsc.type = mood.wave;
    leadOsc.frequency.value = noteFreq(degree + octave);
    const dur = mood.tempo / 1000;
    leadGain.gain.setValueAtTime(0.0001, now);
    leadGain.gain.linearRampToValueAtTime(0.11, now + 0.02);
    leadGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.9);
    leadOsc.connect(filter).connect(leadGain).connect(musicGain);
    leadOsc.start(now); leadOsc.stop(now + dur);

    musicStep++;
  }

  function scheduleMusic() {
    clearInterval(musicTimer);
    const mood = MUSIC_MOODS[musicMood] || MUSIC_MOODS.home;
    musicTimer = setInterval(playMusicStep, mood.tempo);
  }

  function setMusicMood(mode) {
    const key = MUSIC_MOODS[mode] ? mode : 'home';
    if (musicMood === key) return;
    musicMood = key;
    musicStep = 0;
    if (musicOn && audioCtx) scheduleMusic();
  }

  function toggleMusic() {
    musicOn = !musicOn;
    localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0');
    musicToggle.textContent = musicOn ? '🔊' : '🔇';
    musicToggle.classList.toggle('on', musicOn);
    if (musicOn) {
      ensureAudio();
      scheduleMusic();
    } else if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  musicToggle.addEventListener('click', toggleMusic);
  musicToggle.textContent = musicOn ? '🔊' : '🔇';
  musicToggle.classList.toggle('on', musicOn);

  function tryAutoResumeMusic() {
    if (musicOn && !audioCtx) { ensureAudio(); scheduleMusic(); }
    window.removeEventListener('pointerdown', tryAutoResumeMusic);
    window.removeEventListener('keydown', tryAutoResumeMusic);
  }
  window.addEventListener('pointerdown', tryAutoResumeMusic);
  window.addEventListener('keydown', tryAutoResumeMusic);

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
