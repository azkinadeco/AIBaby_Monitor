/* Penyimpanan state aplikasi (localStorage). Nanti di produksi diganti API backend (FastAPI). */
const Store = (() => {
  const KEY = 'aibm.v1';
  const DAY = 86400000;

  const defaults = () => ({
    onboarded: false,
    user: null,               // {name, email, phone, role}
    plan: null,               // 'bundle' | 'app'
    planCycle: 'yearly',
    setupDone: false,
    armed: true,              // pemantauan aktif
    baby: { name: 'Aisyah', birth: isoDaysAgo(128), gender: 'P' },
    cameras: [],              // {id,name,room,type,brand,url,status,res,wifi}
    speakers: [],             // {id,name,type,volume,status}
    settings: {
      detect: {
        cry: { on: true, sens: 'sedang' },
        motion: { on: true, sens: 'sedang' },
        position: { on: true, sens: 'tinggi' },
        vomit: { on: true, sens: 'tinggi' },
        breath: { on: true, sens: 'tinggi' },
        wake: { on: true, sens: 'sedang' },
      },
      alarm: { sound: 'siren', volume: 80, tts: true, escalateSec: 30, wakeSpeaker: false },
      quiet: { on: false, from: '21:00', to: '05:00' },
      push: true, vibrate: true,
      nightVision: 'auto', quality: 'HD', aiOverlay: true, theme: 'auto',
      liveAudio: false,
      pin: false, twoFA: true, e2e: true, cloudRec: true, retention: 7,
    },
    family: [
      { id: 'f1', name: 'Budi (Ayah)', email: 'budi@email.com', role: 'Orang Tua', notify: true },
      { id: 'f2', name: 'Nenek Sri', email: 'sri@email.com', role: 'Pengasuh', notify: true },
    ],
    events: seedEvents(),
    sleepLog: seedSleep(),
    stats: { sleptToday: 0 },
    readUpTo: Date.now() - 2 * 3600000,
  });

  function isoDaysAgo(d) { return new Date(Date.now() - d * DAY).toISOString().slice(0, 10); }

  function seedEvents() {
    const now = Date.now();
    const list = [];
    const mk = (hAgo, type, level, ackSec, falseAlarm) => list.push({
      id: 'e' + Math.random().toString(36).slice(2, 9), type, level,
      ts: now - hAgo * 3600000, ack: true, ackBy: hAgo % 2 ? 'Bunda' : 'Budi (Ayah)',
      ackSec, falseAlarm: !!falseAlarm, latency: +(0.8 + Math.random() * 1.6).toFixed(1), seed: true,
    });
    mk(3.2, 'wake', 'info', 0);
    mk(5.6, 'cry', 'warning', 38);
    mk(9.1, 'motion', 'warning', 52, true);
    mk(22, 'cry', 'warning', 41);
    mk(26.5, 'position', 'critical', 19);
    mk(30, 'wake', 'info', 0);
    mk(47, 'cry', 'warning', 63);
    mk(50, 'breath', 'critical', 15, true);
    mk(70, 'cry', 'warning', 29);
    mk(75, 'motion', 'warning', 44);
    mk(96, 'vomit', 'critical', 22);
    mk(100, 'cry', 'warning', 35);
    mk(122, 'wake', 'info', 0);
    mk(140, 'cry', 'warning', 58);
    return list.sort((a, b) => b.ts - a.ts);
  }

  function seedSleep() {
    const out = [];
    const hrs = [11.2, 12.4, 10.6, 12.9, 11.8, 13.1, 12.2];
    for (let i = 6; i >= 1; i--) {
      out.push({ date: isoDaysAgo(i), hours: hrs[6 - i], wakes: [3, 2, 4, 1, 2, 1][6 - i] || 2 });
    }
    return out;
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function merge(base, over) {
    if (!isObj(over)) return base;
    for (const k of Object.keys(over)) {
      if (isObj(base[k]) && isObj(over[k])) merge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  }

  let s;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  s = merge(defaults(), s || {});

  let saveTimer = null;
  function saveNow() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) {
      // kuota penuh: buang snapshot lama lalu coba lagi
      s.events.forEach((ev, i) => { if (i > 10) delete ev.snap; });
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e2) { /* abaikan */ }
    }
  }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 150); }

  function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), s); }
  function setPath(path, val) {
    const keys = path.split('.');
    let o = s;
    keys.slice(0, -1).forEach(k => { if (!isObj(o[k])) o[k] = {}; o = o[k]; });
    o[keys[keys.length - 1]] = val;
    save();
  }

  function addEvent(ev) {
    s.events.unshift(ev);
    if (s.events.length > 80) s.events.length = 80;
    s.events.forEach((e, i) => { if (i > 24) delete e.snap; });
    save();
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* abaikan */ }
    s = defaults();
  }

  return {
    get s() { return s; },
    save, saveNow, getPath, setPath, addEvent, reset,
  };
})();
