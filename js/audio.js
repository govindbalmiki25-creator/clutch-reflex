/* Clutch Reflex - synthesized sound effects (no audio files, works offline). */
(function () {
  'use strict';
  var ctx = null;
  var enabled = true;

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slide) {
    if (!enabled) return;
    var c = ac();
    if (!c) return;
    var t = c.currentTime;
    var o = c.createOscillator();
    var gain = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol || 0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gain);
    gain.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function seq(notes, gap, dur) {
    notes.forEach(function (f, i) { setTimeout(function () { tone(f, dur, 'triangle', 0.07); }, i * gap); });
  }

  window.CR = window.CR || {};
  window.CR.sfx = {
    setEnabled: function (v) { enabled = !!v; },
    unlock: function () { ac(); },
    hit: function () { tone(880, 0.07, 'triangle', 0.09, 420); },
    miss: function () { tone(170, 0.13, 'sawtooth', 0.045, -70); },
    tick: function () { tone(620, 0.05, 'square', 0.035); },
    go: function () { tone(1250, 0.12, 'square', 0.055); },
    start: function () { seq([440, 660, 880], 90, 0.12); },
    end: function () { seq([523, 659, 784, 1046], 110, 0.18); },
    best: function () { seq([784, 988, 1175, 1568, 1175, 1568], 95, 0.16); },
    click: function () { tone(720, 0.035, 'square', 0.03); }
  };
})();
