/* Clutch Reflex - game flow: attract -> 4 drills -> results + initials -> saved -> attract. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var Store = CR.Store, sfx = CR.sfx, DRILLS = CR.DRILLS, C = CR.COLORS;

  // ?drill=5 shortens each drill (handy for testing). Default 15s x 4 = 60s of play.
  var params = new URLSearchParams(location.search);
  var DRILL_SECONDS = Math.max(3, Math.min(60, Number(params.get('drill')) || 15));
  var CARD_SECONDS = 2.4;       // drill intro + 3-2-1
  var RESULTS_IDLE = 30;        // auto-save and reset if the player walks away
  var SAVED_HOLD = 7;           // how long the "you placed #N" message stays
  var ATTRACT_ARM_MS = 1200;    // ignore stray clicks right after returning to the start screen
  var DEMO_IDLE = 20;           // seconds of idle on attract before demo starts
  var DEMO_DRILL_SEC = 5;       // how long the demo shows each drill
  var CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var BLOCKED = ['ASS', 'FUK', 'FUC', 'FCK', 'CUM', 'SEX', 'TIT', 'DIK', 'DIC', 'KKK', 'NIG', 'NGR', 'FAG', 'COK', 'CNT', 'JIZ', 'WTF', 'XXX', 'POO', 'PEE'];

  var canvas = $('#stage');
  var g = canvas.getContext('2d');
  var view = { w: 0, h: 0, top: 96, left: 0 };

  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  var settings = Store.settings();
  function applySettings() {
    sfx.setEnabled(settings.sound);
    document.querySelectorAll('[data-event-name]').forEach(function (el) { el.textContent = settings.eventName; });
  }
  applySettings();

  var S = {
    state: 'attract', stateT: 0, idleT: 0,
    drillIndex: 0, drill: null, results: [],
    lastCount: 0, initials: ['A', 'A', 'A'], slot: 0,
    final: null, armedAt: 0
  };

  /* ---------- attract-mode demo ---------- */
  // Play area for the demo: keeps targets clear of the top label and the bottom title/call-to-action.
  var demoView = {
    get w() { return view.w; },
    get h() { return view.h - 190; },
    top: 70,
    left: 0
  };

  var demo = {
    on: false,
    drillIndex: 0,
    drill: null,
    drillT: 0,
    // Bot cursor position (smoothed)
    bx: 0, by: 0,
    // Target the bot is aiming at
    tx: 0, ty: 0,
    // Overshoot phase: 0 = approaching, 1 = overshooting, 2 = settling
    phase: 0,
    phaseT: 0,
    // Click timing: when the bot should click after arriving at target
    clickAt: 0,
    // Whether the bot has arrived at the current target
    arrived: false,
    // Reflex-specific: when the target first appeared (for timed click)
    reflexTargetAt: 0,
    // Pointer position when demo started (to ignore tiny pointer moves)
    pointerStartX: 0,
    pointerStartY: 0
  };

  function startDemo() {
    if (demo.on) return;
    demo.on = true;
    demo.drillIndex = 0;
    demo.drillT = 0;
    demo.bx = view.w / 2;
    demo.by = (demoView.top + demoView.h) / 2;
    demo.phase = 0;
    demo.phaseT = 0;
    demo.arrived = false;
    demo.clickAt = 0;
    demo.reflexTargetAt = 0;
    // Record pointer position so tiny moves don't stop the demo
    demo.pointerStartX = 0;
    demo.pointerStartY = 0;
    // Mute sound during demo so no sounds play
    sfx.setEnabled(false);
    demo.drill = DRILLS[0].make(demoView, DEMO_DRILL_SEC);
    document.body.classList.add('demo-running');
    $('#demoOverlay').classList.remove('hidden');
    updateDemoLabel();
  }

  function stopDemo() {
    if (!demo.on) return;
    demo.on = false;
    demo.drill = null;
    // Restore sound
    sfx.setEnabled(settings.sound);
    document.body.classList.remove('demo-running');
    $('#demoOverlay').classList.add('hidden');
    S.idleT = 0;
    // Arm the attract screen so the click that stopped the demo doesn't start a game
    S.armedAt = performance.now() + ATTRACT_ARM_MS;
  }

  function updateDemoLabel() {
    var drillDef = DRILLS[demo.drillIndex];
    $('#demoLabel').textContent = 'DEMO · ' + drillDef.num + ' ' + drillDef.name;
  }

  function botTarget() {
    // Use peek() to get current targets from the drill
    var targets = demo.drill.peek();
    if (!targets || !targets.length) {
      // No targets yet (e.g. Reflex in wait phase) — aim at center
      return { x: view.w / 2, y: (demoView.top + demoView.h) / 2 };
    }
    // Pick the first target (Flick has 1, Precision has up to 3, Track has 1)
    return targets[0];
  }

  function updateBot(dt) {
    var drillDef = DRILLS[demo.drillIndex];
    var target = botTarget();
    demo.tx = target.x;
    demo.ty = target.y;

    // Detect Reflex target appearing (peek returns a target when it was empty before)
    var targets = demo.drill.peek();
    if (drillDef.id === 'react' && targets && targets.length > 0) {
      if (!demo.arrived) {
        // Target just appeared — schedule a click after 220-320ms
        demo.reflexTargetAt = demo.drillT;
        demo.clickAt = demo.drillT + (0.22 + Math.random() * 0.1);
        demo.arrived = true;  // prevent re-scheduling
      }
    }

    // Human-like easing with slight overshoot — frame-rate independent
    var dx = demo.tx - demo.bx;
    var dy = demo.ty - demo.by;
    var d = Math.sqrt(dx * dx + dy * dy);

    if (d > 2) {
      // Ease toward target — use dt for frame-rate independence
      var speed = 1 - Math.pow(0.001, dt);
      demo.bx += dx * speed;
      demo.by += dy * speed;

      // When close, add overshoot
      if (d < 30 && demo.phase === 0) {
        demo.phase = 1;
        demo.phaseT = 0;
      }
    } else {
      // Bot has arrived at target
      if (!demo.arrived && drillDef.id !== 'react') {
        // Flick/Precision: schedule a click after 120-260ms random delay
        demo.clickAt = demo.drillT + (0.12 + Math.random() * 0.14);
        demo.arrived = true;
      }
      demo.phase = 0;
      demo.phaseT = 0;
    }

    // Overshoot: push past the target slightly, then settle back
    if (demo.phase === 1) {
      demo.phaseT += dt;
      var overshoot = Math.sin(demo.phaseT * 8) * 0.15 * (1 - demo.phaseT * 1.5);
      if (overshoot > 0) {
        var angle = Math.atan2(dy, dx || 0.01);
        demo.bx += Math.cos(angle) * overshoot * 40;
        demo.by += Math.sin(angle) * overshoot * 40;
      }
      if (demo.phaseT > 0.7) {
        demo.phase = 0;
      }
    }

    // Check if it's time to click
    if (demo.clickAt > 0 && demo.drillT >= demo.clickAt) {
      demo.clickAt = 0;
      // For Reflex, click at center; for Flick/Precision, click at bot position
      if (drillDef.id === 'react') {
        var c = { x: view.w / 2, y: (demoView.top + demoView.h) / 2 };
        demo.drill.down(c.x, c.y);
      } else if (targets && targets.length > 0) {
        // For Flick/Precision, check if bot is within target radius
        var tg = targets[0];
        var clickD = Math.sqrt((demo.bx - tg.x) ** 2 + (demo.by - tg.y) ** 2);
        var r = tg.r || tg.r0 || 30;  // use r0 for Precision targets
        if (clickD <= r * 1.5) {
          demo.drill.down(demo.bx, demo.by);
        }
      }
      // Reset arrived so next target triggers a new click
      demo.arrived = false;
    }

    // Simulate bot movement on the drill
    demo.drill.move(demo.bx, demo.by);
  }

  function drawBotCursor(g) {
    // Draw a crosshair cursor at the bot's position
    g.save();
    g.strokeStyle = 'rgba(0, 255, 156, 0.7)';
    g.lineWidth = 2;
    var s = 10;
    g.beginPath();
    g.moveTo(demo.bx - s, demo.by); g.lineTo(demo.bx + s, demo.by);
    g.moveTo(demo.bx, demo.by - s); g.lineTo(demo.bx, demo.by + s);
    g.stroke();
    g.beginPath();
    g.arc(demo.bx, demo.by, 3, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0, 255, 156, 0.7)';
    g.fill();
    g.restore();
  }

  function updateDemo(dt) {
    if (!demo.on) return;

    demo.drillT += dt;

    // Update the drill
    demo.drill.update(dt);
    updateBot(dt);

    // Check if this drill segment is done
    if (demo.drillT >= DEMO_DRILL_SEC) {
      demo.drillT = 0;
      demo.drillIndex++;
      if (demo.drillIndex >= DRILLS.length) {
        demo.drillIndex = 0;
      }
      // Reset bot state for the new drill
      demo.arrived = false;
      demo.clickAt = 0;
      demo.reflexTargetAt = 0;
      demo.phase = 0;
      demo.phaseT = 0;
      demo.drill = DRILLS[demo.drillIndex].make(demoView, DEMO_DRILL_SEC);
      updateDemoLabel();
    }
  }

  /* ---------- background clouds ---------- */
  var clouds = [];
  for (var i = 0; i < 14; i++) {
    clouds.push({ x: Math.random(), y: Math.random(), r: 80 + Math.random() * 220, v: 0.004 + Math.random() * 0.012, a: 0.03 + Math.random() * 0.05 });
  }
  function drawBackground(dt) {
    g.clearRect(0, 0, view.w, view.h);
    var dim = S.state === 'drill' ? 0.35 : 1;
    clouds.forEach(function (c) {
      c.x += c.v * dt;
      if (c.x * view.w - c.r > view.w) c.x = -c.r / view.w;
      var x = c.x * view.w, y = c.y * view.h;
      var grad = g.createRadialGradient(x, y, 0, x, y, c.r);
      grad.addColorStop(0, 'rgba(63,182,255,' + (c.a * dim) + ')');
      grad.addColorStop(1, 'rgba(63,182,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, c.r, 0, Math.PI * 2); g.fill();
    });
    if (S.state === 'drill') {
      g.save();
      g.strokeStyle = 'rgba(125,147,173,0.07)';
      g.lineWidth = 1;
      for (var gx = 0; gx < view.w; gx += 48) { g.beginPath(); g.moveTo(gx, view.top); g.lineTo(gx, view.h); g.stroke(); }
      for (var gy = view.top; gy < view.h; gy += 48) { g.beginPath(); g.moveTo(0, gy); g.lineTo(view.w, gy); g.stroke(); }
      g.restore();
    }
  }

  /* ---------- screens ---------- */
  function showOnly(id) {
    ['attract', 'card', 'results'].forEach(function (k) { $('#' + k).classList.toggle('hidden', k !== id); });
  }

  function setState(name) {
    S.state = name;
    S.stateT = 0;
    S.idleT = 0;
    document.body.classList.toggle('in-drill', name === 'drill');
    $('#hud').classList.toggle('hidden', !(name === 'card' || name === 'drill'));

    if (name === 'attract') {
      S.drill = null;
      showOnly('attract');
      renderAttractBoard();
      S.armedAt = performance.now() + ATTRACT_ARM_MS;
    } else if (name === 'card') {
      var d = DRILLS[S.drillIndex];
      showOnly('card');
      $('#cardNum').textContent = d.num + ' / 0' + DRILLS.length;
      $('#cardTitle').textContent = d.name;
      $('#cardDesc').textContent = d.desc;
      $('#cardCount').textContent = '';
      S.lastCount = 0;
      S.drill = null;
      renderHud(d, '', 1);
    } else if (name === 'drill') {
      showOnly(null);
      S.drill = DRILLS[S.drillIndex].make(view, DRILL_SECONDS);
    } else if (name === 'results') {
      S.drill = null;
      showResults();
    } else if (name === 'saved') {
      $('#entry').classList.add('hidden');
      $('#savedMsg').classList.remove('hidden');
    }
  }

  function renderHud(d, stat, frac) {
    $('#hudName').textContent = d.name;
    $('#hudStat').textContent = stat;
    var bar = $('#timerBar');
    bar.style.transform = 'scaleX(' + Math.max(0, frac) + ')';
    bar.classList.toggle('low', frac < 0.2);
    var pips = $('#pips');
    if (pips.children.length !== DRILLS.length) {
      pips.innerHTML = DRILLS.map(function () { return '<i></i>'; }).join('');
    }
    Array.prototype.forEach.call(pips.children, function (p, idx) {
      p.className = idx < S.drillIndex ? 'done' : idx === S.drillIndex ? 'active' : '';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function renderAttractBoard() {
    var list = Store.today().slice(0, 5);
    $('#attractBoard').innerHTML = list.length
      ? list.map(function (e, idx) {
        return '<li><span class="rank">' + (idx + 1) + '</span><span class="who">' + escapeHtml(e.name) +
          '<small>' + escapeHtml(e.role || '') + '</small></span><span class="pts">' + e.score + '</span></li>';
      }).join('')
      : '<li class="empty">No scores yet today. Be the first.</li>';
  }

  /* ---------- run flow ---------- */
  function startRun() {
    sfx.unlock();
    sfx.start();
    S.results = [];
    S.drillIndex = 0;
    setState('card');
  }

  function finishDrill() {
    var d = DRILLS[S.drillIndex];
    var r = S.drill.result();
    S.results.push({ id: d.id, name: d.name, skill: r.skill, stat: r.stat });
    if (S.drillIndex < DRILLS.length - 1) {
      S.drillIndex++;
      setState('card');
    } else {
      sfx.end();
      setState('results');
    }
  }

  function abortToAttract() {
    if (S.state !== 'attract') setState('attract');
  }

  /* ---------- results ---------- */
  function showResults() {
    var skills = {};
    var sum = 0;
    S.results.forEach(function (r) { skills[r.id] = r.skill; sum += r.skill; });
    var role = CR.roleFor(skills);
    S.final = { score: Math.round(sum * 15), skills: skills, role: role };
    S.initials = ['A', 'A', 'A'];
    S.slot = 0;
    S.radarDone = false;

    $('#finalScore').textContent = '0';
    $('#roleName').textContent = role.name;
    $('#roleBlurb').textContent = role.blurb;
    $('#statList').innerHTML = S.results.map(function (r) {
      return '<li><b>' + r.name + '</b><span class="bar"><i style="width:' + r.skill + '%"></i></span><span class="num">' + r.skill +
        '</span><small>' + escapeHtml(r.stat) + '</small></li>';
    }).join('');
    $('#entry').classList.remove('hidden');
    $('#savedMsg').classList.add('hidden');
    renderInitials();
    showOnly('results');
  }

  function drawRadar(progress) {
    var rc = $('#radar');
    var ctx = rc.getContext('2d');
    var W = 340, H = 340, cx = W / 2, cy = H / 2, R = W * 0.29;
    ctx.setTransform(rc.width / W, 0, 0, rc.height / H, 0, 0); // canvas is 2x for sharp rendering
    var axes = S.results;
    var n = axes.length;
    ctx.clearRect(0, 0, W, H);
    function pt(idx, v) {
      var a = -Math.PI / 2 + idx * (Math.PI * 2 / n);
      return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
    }
    ctx.strokeStyle = 'rgba(125,147,173,0.3)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(function (k) {
      ctx.beginPath();
      for (var j = 0; j < n; j++) { var p = pt(j, k); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.closePath(); ctx.stroke();
    });
    for (var j = 0; j < n; j++) { var p = pt(j, 1); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]); ctx.stroke(); }

    ctx.beginPath();
    axes.forEach(function (a, idx) { var q = pt(idx, Math.max(0.03, a.skill / 100) * progress); idx ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.closePath();
    ctx.fillStyle = 'rgba(63,182,255,0.28)';
    ctx.strokeStyle = C.sky;
    ctx.lineWidth = 3;
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#eef6ff';
    ctx.font = '800 15px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    axes.forEach(function (a, idx) {
      var q = pt(idx, 1.24);
      ctx.fillText(a.name.toUpperCase(), q[0], q[1]);
    });
  }

  function renderInitials() {
    var box = $('#initials');
    if (!box.children.length) {
      box.innerHTML = [0, 1, 2].map(function (idx) {
        return '<div class="slot" data-i="' + idx + '"><button type="button" data-d="1" aria-label="Next letter">▲</button>' +
          '<div class="ch"></div><button type="button" data-d="-1" aria-label="Previous letter">▼</button></div>';
      }).join('');
      box.addEventListener('pointerdown', function (e) {
        var slot = e.target.closest('.slot');
        if (!slot) return;
        var idx = Number(slot.dataset.i);
        S.slot = idx;
        if (e.target.dataset.d) cycle(idx, Number(e.target.dataset.d));
        sfx.click();
        renderInitials();
      });
    }
    Array.prototype.forEach.call(box.children, function (slot, idx) {
      slot.querySelector('.ch').textContent = S.initials[idx];
      slot.classList.toggle('active', idx === S.slot);
    });
  }

  function cycle(idx, dir) {
    var pos = CHARSET.indexOf(S.initials[idx]);
    S.initials[idx] = CHARSET[(pos + dir + CHARSET.length) % CHARSET.length];
  }

  function lockIn() {
    if (S.state !== 'results') return;
    var name = S.initials.join('');
    if (BLOCKED.indexOf(name) !== -1) name = 'C9!';
    var entry = Store.add({ name: name, score: S.final.score, skills: S.final.skills, role: S.final.role.name });
    var today = Store.today();
    var rank = Store.rankToday(entry.id);
    var msg = $('#savedMsg');
    if (rank === 1 && today.length > 1) {
      msg.innerHTML = '<span class="big">NEW DAILY BEST!</span>' + escapeHtml(name) + ' takes #1 today';
      sfx.best();
    } else {
      msg.innerHTML = '<span class="big">#' + rank + ' today</span>out of ' + today.length + ' player' + (today.length === 1 ? '' : 's');
    }
    msg.innerHTML += '<small>Check the leaderboard screen. Next player up!</small>';
    setState('saved');
  }

  /* ---------- main loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    S.stateT += dt;
    S.idleT += dt;
    update(dt);
    drawBackground(dt);
    if (S.state === 'drill' && S.drill) S.drill.draw(g);
    if (demo.on && demo.drill) {
      demo.drill.draw(g);
      drawBotCursor(g);
    }
    requestAnimationFrame(frame);
  }

  function update(dt) {
    // Demo runs on top of attract state
    if (demo.on) {
      updateDemo(dt);
      return;
    }
    if (S.state === 'attract' && S.idleT >= DEMO_IDLE) {
      startDemo();
    }
    if (S.state === 'card') {
      var remaining = CARD_SECONDS - S.stateT;
      var count = Math.max(1, Math.ceil(remaining / (CARD_SECONDS / 3)));
      if (count !== S.lastCount && remaining > 0) {
        S.lastCount = count;
        $('#cardCount').textContent = count;
        sfx.tick();
      }
      if (remaining <= 0) setState('drill');
    } else if (S.state === 'drill') {
      S.drill.update(dt);
      renderHud(DRILLS[S.drillIndex], S.drill.hud(), 1 - S.stateT / DRILL_SECONDS);
      if (S.stateT >= DRILL_SECONDS) finishDrill();
    } else if (S.state === 'results') {
      var p = Math.min(1, S.stateT / 1.3);
      var eased = 1 - Math.pow(1 - p, 3);
      $('#finalScore').textContent = Math.round(S.final.score * eased);
      if (p < 1 || !S.radarDone) { drawRadar(eased); S.radarDone = p >= 1; }
      if (S.idleT > RESULTS_IDLE) lockIn();
    } else if (S.state === 'saved') {
      if (S.stateT > SAVED_HOLD) setState('attract');
    }
  }

  /* ---------- input ---------- */
  function toCanvas(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  canvas.addEventListener('pointerdown', function (e) {
    if (S.state === 'drill' && S.drill && e.button === 0) {
      var p = toCanvas(e);
      S.drill.down(p.x, p.y);
    }
  });
  window.addEventListener('pointermove', function (e) {
    if (demo.on) {
      // Ignore tiny or synthetic pointer moves — only stop if moved more than 4px
      var p = toCanvas(e);
      if (!demo.pointerStartX && !demo.pointerStartY) {
        demo.pointerStartX = p.x;
        demo.pointerStartY = p.y;
      }
      var dp = Math.sqrt((p.x - demo.pointerStartX) ** 2 + (p.y - demo.pointerStartY) ** 2);
      if (dp > 4) { stopDemo(); return; }
      return;
    }
    S.idleT = 0;
    if (S.state === 'drill' && S.drill) { var p = toCanvas(e); S.drill.move(p.x, p.y); }
  });
  document.documentElement.addEventListener('pointerleave', function () { if (S.drill) S.drill.leave(); });
  window.addEventListener('blur', function () { if (S.drill) S.drill.leave(); });

  $('#attract').addEventListener('pointerdown', function (e) {
    if (demo.on) { stopDemo(); return; }
    if (performance.now() < S.armedAt) return;
    if (e.target.closest('.mini-board')) return;
    startRun();
  });
  $('#demoOverlay').addEventListener('pointerdown', function (e) {
    if (demo.on) stopDemo();
  });
  $('#lockBtn').addEventListener('click', lockIn);
  $('#results').addEventListener('pointerdown', function () { S.idleT = 0; });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (demo.on) stopDemo();
      if (S.state === 'card' || S.state === 'drill') abortToAttract();
    }
  });

  window.addEventListener('keydown', function (e) {
    if (demo.on) { stopDemo(); return; }
    if (!$('#operator').classList.contains('hidden')) {
      if (e.key === 'Escape') closeOperator();
      return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) { e.preventDefault(); openOperator(); return; }
    if (e.key === 'f' || e.key === 'F') { if (S.state !== 'results') toggleFullscreen(); return; }
    if (e.key === 'Escape') { abortToAttract(); return; }

    if (S.state === 'attract' && (e.key === 'Enter' || e.key === ' ')) {
      if (performance.now() >= S.armedAt) startRun();
      return;
    }
    if (S.state === 'results') {
      S.idleT = 0;
      var k = e.key.toUpperCase();
      if (k.length === 1 && CHARSET.indexOf(k) !== -1) {
        S.initials[S.slot] = k;
        S.slot = Math.min(2, S.slot + 1);
      } else if (e.key === 'Backspace') {
        S.slot = Math.max(0, S.slot - 1);
      } else if (e.key === 'ArrowUp') cycle(S.slot, 1);
      else if (e.key === 'ArrowDown') cycle(S.slot, -1);
      else if (e.key === 'ArrowLeft') S.slot = Math.max(0, S.slot - 1);
      else if (e.key === 'ArrowRight') S.slot = Math.min(2, S.slot + 1);
      else if (e.key === 'Enter') { lockIn(); return; }
      else return;
      sfx.click();
      renderInitials();
    }
  });

  /* ---------- operator panel ---------- */
  var cornerTaps = [];
  $('#corner').addEventListener('pointerdown', function (e) {
    e.stopPropagation();
    var now = performance.now();
    cornerTaps = cornerTaps.filter(function (t) { return now - t < 3000; });
    cornerTaps.push(now);
    if (cornerTaps.length >= 5) { cornerTaps = []; openOperator(); }
  });

  function openOperator() {
    if (S.state === 'card' || S.state === 'drill') abortToAttract();
    $('#opEvent').value = settings.eventName;
    $('#opSound').checked = settings.sound;
    $('#operator').classList.remove('hidden');
  }
  function closeOperator() {
    settings.eventName = $('#opEvent').value.trim() || Store.settings().eventName;
    settings.sound = $('#opSound').checked;
    Store.saveSettings(settings);
    applySettings();
    $('#operator').classList.add('hidden');
    S.armedAt = performance.now() + ATTRACT_ARM_MS;
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  }

  $('#operator').addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  $('#opClose').addEventListener('click', closeOperator);
  $('#opFull').addEventListener('click', toggleFullscreen);
  $('#opBoard').addEventListener('click', function () { window.open('leaderboard.html', 'clutch-reflex-board'); });
  $('#opCsv').addEventListener('click', function () {
    var blob = new Blob([Store.toCSV()], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'clutch-reflex-scores-' + Store.dayKey() + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  $('#opToday').addEventListener('click', function () {
    if (confirm("Delete all of today's scores? This cannot be undone.")) { Store.clearToday(); renderAttractBoard(); }
  });
  $('#opAll').addEventListener('click', function () {
    if (confirm('Delete ALL scores from every day? This cannot be undone.')) { Store.clearAll(); renderAttractBoard(); }
  });

  // Keep the start screen's top 5 fresh if another window changes scores.
  Store.subscribe(function () { if (S.state === 'attract') renderAttractBoard(); });

  setState('attract');
  requestAnimationFrame(frame);

  // Exposed for automated playtesting only.
  window.CR.debug = {
    state: function () { return S.state; },
    S: S,
    // Advance the game by dt seconds without requestAnimationFrame (headless / background testing).
    step: function (dt) {
      S.stateT += dt; S.idleT += dt;
      update(dt);
      drawBackground(dt);
      if (S.state === 'drill' && S.drill) S.drill.draw(g);
    }
  };
})();
