/* Clutch Reflex - the four skill drills.
 *
 * Every drill is created with make(view, duration) and returns:
 *   update(dt), draw(ctx), down(x, y), move(x, y), leave(), hud() -> string,
 *   result() -> { skill: 0..100, stat: string }
 * `view` is a live object {w, h, top, left} kept current by the game on resize.
 */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var COLORS = { sky: '#3fb6ff', gold: '#ffd34d', red: '#ff5470', ink: '#07121f', white: '#ffffff', mute: '#7d93ad' };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
  function mean(arr) { return arr.length ? arr.reduce(function (s, v) { return s + v; }, 0) / arr.length : 0; }
  function easeOut(k) { return 1 - Math.pow(1 - clamp(k, 0, 1), 3); }
  function minSide(view) { return Math.min(view.w, view.h - view.top); }
  function center(view) { return { x: view.w / 2, y: (view.top + view.h) / 2 }; }

  function drawTarget(g, x, y, r, color, alpha) {
    if (r <= 0.5) return;
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.shadowColor = color;
    g.shadowBlur = r * 0.9;
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = COLORS.ink;
    g.beginPath(); g.arc(x, y, r * 0.68, 0, TAU); g.fill();
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, r * 0.42, 0, TAU); g.fill();
    g.fillStyle = COLORS.white;
    g.beginPath(); g.arc(x, y, Math.max(1.5, r * 0.14), 0, TAU); g.fill();
    g.restore();
  }

  /* Floating text + hit bursts */
  function Fx() { this.items = []; }
  Fx.prototype.text = function (x, y, txt, color) { this.items.push({ k: 't', x: x, y: y, txt: txt, color: color, t: 0, life: 0.75 }); };
  Fx.prototype.burst = function (x, y, color) { this.items.push({ k: 'b', x: x, y: y, color: color, t: 0, life: 0.35 }); };
  Fx.prototype.update = function (dt) {
    this.items.forEach(function (it) { it.t += dt; });
    this.items = this.items.filter(function (it) { return it.t < it.life; });
  };
  Fx.prototype.draw = function (g) {
    this.items.forEach(function (it) {
      var p = it.t / it.life;
      g.save();
      g.globalAlpha = 1 - p;
      if (it.k === 't') {
        g.fillStyle = it.color;
        g.font = '800 18px system-ui, -apple-system, "Segoe UI", sans-serif';
        g.textAlign = 'center';
        g.fillText(it.txt, it.x, it.y - easeOut(p) * 26);
      } else {
        g.strokeStyle = it.color;
        g.lineWidth = 4 * (1 - p) + 1;
        g.beginPath(); g.arc(it.x, it.y, 14 + easeOut(p) * 46, 0, TAU); g.stroke();
      }
      g.restore();
    });
  };

  function randomPoint(view, r, pad) {
    pad = pad || 24;
    return {
      x: rand(view.left + r + pad, view.w - r - pad),
      y: rand(view.top + r + pad, view.h - r - pad)
    };
  }

  /* ---------- 01 FLICK: snap to one target at a time, far from the last one ---------- */
  function Flick(view, dur) {
    var s = { t: 0, hits: 0, misses: 0, times: [], target: null, fx: new Fx() };
    function radius() { return Math.max(18, minSide(view) * 0.034); }
    function spawn() {
      var r = radius(), p, tries = 0;
      do {
        p = randomPoint(view, r);
        tries++;
      } while (s.target && dist(p.x, p.y, s.target.x, s.target.y) < minSide(view) * 0.32 && tries < 25);
      s.target = { x: p.x, y: p.y, r: r, born: s.t };
    }
    spawn();
    return {
      peek: function () { return [s.target]; },
      hud: function () { return s.hits + ' hit' + (s.hits === 1 ? '' : 's'); },
      update: function (dt) { s.t += dt; s.fx.update(dt); },
      draw: function (g) {
        var tg = s.target;
        var k = easeOut((s.t - tg.born) / 0.12);
        drawTarget(g, tg.x, tg.y, tg.r * (0.55 + 0.45 * k), COLORS.sky);
        s.fx.draw(g);
      },
      down: function (x, y) {
        var tg = s.target;
        if (dist(x, y, tg.x, tg.y) <= tg.r * 1.1) {
          var ms = Math.round((s.t - tg.born) * 1000);
          s.hits++; s.times.push(ms);
          s.fx.burst(tg.x, tg.y, COLORS.sky);
          s.fx.text(tg.x, tg.y - tg.r - 10, ms + 'ms', COLORS.white);
          CR.sfx.hit();
          spawn();
        } else {
          s.misses++;
          s.fx.text(x, y, 'MISS', COLORS.red);
          CR.sfx.miss();
        }
      },
      move: function () {}, leave: function () {},
      result: function () {
        var acc = s.hits / Math.max(1, s.hits + s.misses);
        var rate = clamp(s.hits / (dur * 1.5), 0, 1);
        var skill = s.hits ? Math.round(100 * (0.65 * rate + 0.35 * acc)) : 0;
        return { skill: skill, stat: s.hits + ' hits · ' + Math.round(mean(s.times)) + 'ms avg · ' + Math.round(acc * 100) + '% acc' };
      }
    };
  }

  /* ---------- 02 TRACK: keep the crosshair on a moving target (no clicking) ---------- */
  function Track(view, dur) {
    var GRACE = 0.6;
    var s = { t: 0, active: 0, on: 0, px: -1, py: -1, inside: false, onNow: false, pos: { x: 0, y: 0 },
      ph: [rand(0, TAU), rand(0, TAU), rand(0, TAU), rand(0, TAU)], trail: [] };
    function radius() { return Math.max(26, minSide(view) * 0.05); }
    function pos(t) {
      var c = center(view);
      var ax = (view.w - 200) / 2 * 0.85;
      var ay = (view.h - view.top - 160) / 2 * 0.85;
      var sp = 1 + (t / dur) * 0.5; // speeds up as the drill goes on
      return {
        x: c.x + ax * (0.65 * Math.sin(0.85 * sp * t + s.ph[0]) + 0.35 * Math.sin(2.2 * sp * t + s.ph[1])),
        y: c.y + ay * (0.6 * Math.sin(1.05 * sp * t + s.ph[2]) + 0.4 * Math.sin(1.8 * sp * t + s.ph[3]))
      };
    }
    s.pos = pos(0);
    return {
      peek: function () { return [s.pos]; },
      hud: function () { return (s.active ? Math.round(s.on / s.active * 100) : 0) + '% on target'; },
      update: function (dt) {
        s.t += dt;
        s.pos = pos(s.t);
        s.trail.push({ x: s.pos.x, y: s.pos.y });
        if (s.trail.length > 18) s.trail.shift();
        s.onNow = s.inside && dist(s.px, s.py, s.pos.x, s.pos.y) <= radius();
        if (s.t > GRACE) {
          s.active += dt;
          if (s.onNow) s.on += dt;
        }
      },
      draw: function (g) {
        var r = radius();
        g.save();
        s.trail.forEach(function (p, i) {
          g.globalAlpha = (i / s.trail.length) * 0.18;
          g.fillStyle = COLORS.sky;
          g.beginPath(); g.arc(p.x, p.y, r * 0.6, 0, TAU); g.fill();
        });
        g.restore();
        var color = s.onNow ? COLORS.gold : COLORS.sky;
        drawTarget(g, s.pos.x, s.pos.y, r, color);
        if (s.onNow) {
          g.save();
          g.strokeStyle = COLORS.gold;
          g.lineWidth = 3;
          g.globalAlpha = 0.6 + 0.4 * Math.sin(s.t * 20);
          g.beginPath(); g.arc(s.pos.x, s.pos.y, r + 10, 0, TAU); g.stroke();
          g.restore();
        }
        if (s.t < GRACE) {
          g.save();
          g.fillStyle = COLORS.white;
          g.font = '800 16px system-ui, -apple-system, "Segoe UI", sans-serif';
          g.textAlign = 'center';
          g.fillText('GET ON IT', s.pos.x, s.pos.y - r - 16);
          g.restore();
        }
      },
      down: function () {},
      move: function (x, y) { s.px = x; s.py = y; s.inside = true; },
      leave: function () { s.inside = false; },
      result: function () {
        var ratio = s.active ? s.on / s.active : 0;
        return { skill: Math.round(100 * clamp(ratio / 0.9, 0, 1)), stat: Math.round(ratio * 100) + '% time on target' };
      }
    };
  }

  /* ---------- 03 REFLEX: wait for gold, then click anywhere ---------- */
  function React(view, dur) {
    var s = { phase: 'wait', phaseT: 0, next: rand(0.9, 2.1), goAt: 0, times: [], early: 0, slow: 0, msg: '', msgColor: COLORS.white, t: 0 };
    function toWait() { s.phase = 'wait'; s.phaseT = 0; s.next = rand(0.8, 2.0); }
    function feedback(msg, color) { s.phase = 'feedback'; s.phaseT = 0; s.msg = msg; s.msgColor = color; }
    return {
      peek: function () { return s.phase === 'go' ? [center(view)] : []; },
      hud: function () {
        if (!s.times.length) return 'best —';
        return 'best ' + Math.min.apply(null, s.times) + 'ms';
      },
      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;
        if (s.phase === 'wait' && s.phaseT >= s.next) {
          s.phase = 'go'; s.phaseT = 0; s.goAt = performance.now();
          CR.sfx.go();
        } else if (s.phase === 'go' && s.phaseT > 1.0) {
          s.slow++;
          feedback('TOO SLOW', COLORS.red);
          CR.sfx.miss();
        } else if (s.phase === 'feedback' && s.phaseT > 0.75) {
          toWait();
        }
      },
      draw: function (g) {
        var c = center(view);
        var R = Math.max(70, minSide(view) * 0.17);
        g.save();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        if (s.phase === 'go') {
          g.fillStyle = 'rgba(255, 211, 77, 0.16)';
          g.fillRect(0, 0, view.w, view.h);
          g.shadowColor = COLORS.gold; g.shadowBlur = 60;
          g.fillStyle = COLORS.gold;
          g.beginPath(); g.arc(c.x, c.y, R * (1 + 0.06 * Math.sin(s.phaseT * 40)), 0, TAU); g.fill();
          g.shadowBlur = 0;
          g.fillStyle = COLORS.ink;
          g.font = '900 ' + Math.round(R * 0.42) + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
          g.fillText('CLICK', c.x, c.y);
        } else if (s.phase === 'wait') {
          g.strokeStyle = 'rgba(125, 147, 173, 0.5)';
          g.lineWidth = 4;
          g.setLineDash([10, 12]);
          g.lineDashOffset = -s.t * 30;
          g.beginPath(); g.arc(c.x, c.y, R, 0, TAU); g.stroke();
          g.setLineDash([]);
          g.fillStyle = COLORS.mute;
          g.font = '800 ' + Math.round(R * 0.3) + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
          g.fillText('WAIT…', c.x, c.y);
        } else {
          g.fillStyle = s.msgColor;
          g.font = '900 ' + Math.round(R * 0.42) + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
          g.fillText(s.msg, c.x, c.y);
        }
        g.restore();
      },
      down: function () {
        if (s.phase === 'wait') {
          s.early++;
          feedback('TOO SOON', COLORS.red);
          CR.sfx.miss();
        } else if (s.phase === 'go') {
          var ms = Math.round(performance.now() - s.goAt);
          s.times.push(ms);
          feedback(ms + 'ms', ms < 250 ? COLORS.gold : COLORS.white);
          CR.sfx.hit();
        }
      },
      move: function () {}, leave: function () {},
      result: function () {
        if (!s.times.length) return { skill: 0, stat: 'no reactions · ' + s.early + ' early' };
        var avg = mean(s.times);
        var base = clamp((450 - avg) / (450 - 200), 0, 1) * 100;
        var skill = Math.round(clamp(base - s.early * 8 - s.slow * 10, 0, 100));
        return { skill: skill, stat: 'best ' + Math.min.apply(null, s.times) + 'ms · avg ' + Math.round(avg) + 'ms · ' + s.early + ' early' };
      }
    };
  }

  /* ---------- 04 PRECISION: three shrinking targets at a time ---------- */
  function Precision(view, dur) {
    var LIFE = 2.3;
    var s = { t: 0, targets: [], queue: [0.05, 0.45, 0.85], hits: 0, expired: 0, misclicks: 0, fx: new Fx() };
    function r0() { return Math.max(16, minSide(view) * 0.03); }
    function radius(tg) {
      var age = s.t - tg.born;
      return tg.r0 * Math.min(1, age / 0.1) * clamp(1 - age / LIFE, 0, 1);
    }
    function spawn() {
      var r = r0(), p, ok, tries = 0;
      do {
        p = randomPoint(view, r, 40);
        ok = s.targets.every(function (o) { return dist(p.x, p.y, o.x, o.y) > r * 5; });
        tries++;
      } while (!ok && tries < 30);
      s.targets.push({ x: p.x, y: p.y, r0: r, born: s.t });
    }
    return {
      peek: function () { return s.targets.filter(function (tg) { return s.t - tg.born > 0.1; }); },
      hud: function () { return s.hits + ' hits · ' + s.expired + ' lost'; },
      update: function (dt) {
        s.t += dt;
        s.fx.update(dt);
        var keep = [];
        s.targets.forEach(function (tg) {
          if (s.t - tg.born >= LIFE) {
            s.expired++;
            s.fx.text(tg.x, tg.y, '✕', COLORS.mute);
            s.queue.push(s.t + 0.15);
          } else keep.push(tg);
        });
        s.targets = keep;
        s.queue = s.queue.filter(function (q) { if (s.t >= q) { spawn(); return false; } return true; });
      },
      draw: function (g) {
        s.targets.forEach(function (tg) {
          var r = radius(tg);
          var life = 1 - (s.t - tg.born) / LIFE;
          g.save();
          g.strokeStyle = 'rgba(63, 182, 255, 0.35)';
          g.lineWidth = 2;
          g.beginPath(); g.arc(tg.x, tg.y, tg.r0 + 8, -Math.PI / 2, -Math.PI / 2 + TAU * life); g.stroke();
          g.restore();
          drawTarget(g, tg.x, tg.y, r, life < 0.3 ? COLORS.red : COLORS.sky);
        });
        s.fx.draw(g);
      },
      down: function (x, y) {
        var best = null, bestD = Infinity;
        s.targets.forEach(function (tg) {
          var d = dist(x, y, tg.x, tg.y);
          if (d <= radius(tg) + 3 && d < bestD) { best = tg; bestD = d; }
        });
        if (best) {
          s.hits++;
          s.targets.splice(s.targets.indexOf(best), 1);
          s.fx.burst(best.x, best.y, COLORS.sky);
          s.queue.push(s.t + 0.15);
          CR.sfx.hit();
        } else {
          s.misclicks++;
          s.fx.text(x, y, 'MISS', COLORS.red);
          CR.sfx.miss();
        }
      },
      move: function () {}, leave: function () {},
      result: function () {
        var acc = s.hits / Math.max(1, s.hits + s.expired + s.misclicks);
        var rate = clamp(s.hits / (dur * 1.3), 0, 1);
        var skill = s.hits ? Math.round(100 * (0.55 * acc + 0.45 * rate)) : 0;
        return { skill: skill, stat: s.hits + ' hits · ' + Math.round(acc * 100) + '% accuracy' };
      }
    };
  }

  var DRILLS = [
    { id: 'flick', num: '01', name: 'Flick', desc: 'Snap to each target as fast as you can.', make: Flick },
    { id: 'track', num: '02', name: 'Track', desc: 'Keep your crosshair on the moving target. No clicking.', make: Track },
    { id: 'react', num: '03', name: 'Reflex', desc: 'Wait for gold, then click. Too early costs you.', make: React },
    { id: 'precision', num: '04', name: 'Precision', desc: 'Hit the shrinking targets before they vanish.', make: Precision }
  ];

  var ROLES = {
    flick: { name: 'Spearhead', blurb: 'First through the door. Your flicks open up rounds before the enemy can react.' },
    track: { name: 'Hunter', blurb: 'Once you are on someone, you stay on them. Moving targets do not escape you.' },
    react: { name: 'Sentry', blurb: 'Nothing gets past you. You hold the angle and win the reaction duel.' },
    precision: { name: 'Marksman', blurb: 'Small targets, steady hand. You make every shot count.' },
    flex: { name: 'Flex', blurb: 'Balanced across the board. Teams build around players who can fill any role.' }
  };

  function roleFor(skills) {
    var ids = Object.keys(skills);
    var vals = ids.map(function (k) { return skills[k]; });
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    if (max - min < 12) return ROLES.flex;
    return ROLES[ids[vals.indexOf(max)]];
  }

  window.CR = window.CR || {};
  window.CR.DRILLS = DRILLS;
  window.CR.roleFor = roleFor;
  window.CR.COLORS = COLORS;
})();
