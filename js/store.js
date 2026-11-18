/* Clutch Reflex - local, offline score storage shared between the game and the leaderboard screen. */
(function () {
  'use strict';
  var KEY = 'clutchreflex.scores.v1';
  var SKEY = 'clutchreflex.settings.v1';
  var MAX_ENTRIES = 5000;
  var mem = {}; // fallback when localStorage is unavailable (private mode, blocked storage)

  function read(k, fallback) {
    try {
      var v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return k in mem ? mem[k] : fallback;
    }
  }
  function write(k, v) {
    mem[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* memory only */ }
  }

  var channel = null;
  try { channel = new BroadcastChannel('clutch-reflex'); } catch (e) { channel = null; }

  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function byScore(a, b) { return b.score - a.score || a.ts - b.ts; }

  var DEFAULT_SETTINGS = { sound: true, eventName: "Sky's The Limit · Booth Edition" };

  var Store = {
    dayKey: dayKey,
    all: function () { var l = read(KEY, []); return Array.isArray(l) ? l : []; },
    add: function (entry) {
      var list = this.all();
      entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      entry.ts = Date.now();
      entry.day = dayKey(entry.ts);
      list.push(entry);
      if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
      write(KEY, list);
      this.notify({ type: 'score', id: entry.id });
      return entry;
    },
    today: function () { var d = dayKey(); return this.all().filter(function (e) { return e.day === d; }).sort(byScore); },
    allTime: function () { return this.all().sort(byScore); },
    rankToday: function (id) { return this.today().findIndex(function (e) { return e.id === id; }) + 1; },
    clearToday: function () {
      var d = dayKey();
      write(KEY, this.all().filter(function (e) { return e.day !== d; }));
      this.notify({ type: 'reset' });
    },
    clearAll: function () { write(KEY, []); this.notify({ type: 'reset' }); },
    settings: function () { return Object.assign({}, DEFAULT_SETTINGS, read(SKEY, {})); },
    saveSettings: function (s) { write(SKEY, s); this.notify({ type: 'settings' }); },
    notify: function (msg) { if (channel) { try { channel.postMessage(msg); } catch (e) { /* ignore */ } } },
    subscribe: function (fn) {
      if (channel) channel.addEventListener('message', function (e) { fn(e.data || {}); });
      window.addEventListener('storage', function (e) {
        if (e.key === KEY || e.key === SKEY || e.key === null) fn({ type: 'storage' });
      });
    },
    toCSV: function () {
      var rows = [['date', 'time', 'name', 'score', 'role', 'flick', 'track', 'reflex', 'precision']];
      this.all().forEach(function (e) {
        var d = new Date(e.ts), s = e.skills || {};
        rows.push([e.day, pad(d.getHours()) + ':' + pad(d.getMinutes()), e.name, e.score, e.role,
          s.flick, s.track, s.react, s.precision]);
      });
      return rows.map(function (r) {
        return r.map(function (c) { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
      }).join('\n');
    }
  };

  window.CR = window.CR || {};
  window.CR.Store = Store;
})();
