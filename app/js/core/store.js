/* State aplikasi yang tersimpan di perangkat (localStorage).
   Satu sumber kebenaran; layar membaca dari sini, perubahan disimpan otomatis (debounce). */
import { bus } from './bus.js';
import { DAY, HOUR, MIN, uid } from './util.js';

const KEY = 'aibm.v3';
const LEGACY_KEY = 'aibm.v1';
const MAX_EVENTS = 150;
const MAX_SNAPS = 20;          // cuplikan JPEG makan tempat: simpan hanya untuk 20 kejadian terbaru

const isoDaysAgo = d => new Date(Date.now() - d * DAY).toISOString().slice(0, 10);

function defaults() {
  return {
    v: 3,
    onboarded: false,
    /** Peran perangkat ini: demo (simulasi) | parent (monitor orang tua) | baby (kamera bayi) */
    mode: 'demo',
    armed: true,                // pemantauan AI aktif
    listen: false,              // dengarkan suara kamar terus-menerus
    parentName: 'Bunda',
    baby: { name: 'Si Kecil', birth: isoDaysAgo(128), gender: 'P', photo: null, note: '' },
    pair: { code: '', secret: '' },   // (monitor orang tua) kamera bayi yang dipasangkan
    own: { code: '', secret: '' },    // (kamera bayi) kode pairing milik HP ini
    settings: {
      detect: {
        cry: { on: true, sens: 'sedang' },
        motion: { on: true, sens: 'sedang' },
        wake: { on: true, sens: 'sedang' },
        position: { on: true, sens: 'tinggi' },
        vomit: { on: true, sens: 'tinggi' },
        breath: { on: true, sens: 'tinggi' },
      },
      alarm: {
        sound: 'siren', volume: 85, voice: true, vibrate: true, notify: true,
        quiet: { on: false, from: '21:00', to: '05:00' },
        autoSoothe: true, sootheTrack: 'noise', sootheMins: 20,
      },
      theme: 'auto',            // auto | light | dark
      nightVision: 'auto',      // auto | on | off (kamera demo)
      pinHash: '',              // kosong = kunci aplikasi nonaktif
      babyDim: true,            // kamera bayi: layar diredupkan agar hemat baterai
    },
    events: [],
    care: [],
    sleep: [],                  // sesi tidur [{id, start, end|null}]
    growth: [],
    milestones: {},
  };
}

/* ---------- Data contoh untuk mode demo ---------- */
function seedDemo(s) {
  const now = Date.now();
  const ev = (hAgo, type, level, extra = {}) => ({
    id: 'e' + uid(), type, level, ts: now - hAgo * HOUR, ack: level !== 'info',
    ackSec: level === 'info' ? 0 : 15 + Math.round(Math.random() * 45), falseAlarm: false, seed: true, ...extra,
  });
  s.events = [
    ev(1.6, 'wake', 'info'), ev(3.4, 'cry', 'warning'), ev(9.1, 'motion', 'warning', { falseAlarm: true }),
    ev(22, 'cry', 'warning'), ev(26.5, 'position', 'critical'), ev(30, 'wake', 'info'), ev(47, 'cry', 'warning'),
    ev(70, 'cry', 'warning'), ev(96, 'vomit', 'critical'), ev(122, 'wake', 'info'), ev(140, 'cry', 'warning'),
  ];
  const c = (hAgo, type, detail) => ({ id: 'c' + uid(), type, detail, ts: now - hAgo * HOUR, by: 'Bunda', seed: true });
  s.care = [
    c(1.3, 'milk', '110 ml · ASI perah'), c(2.6, 'diaper', 'Pipis'), c(4.4, 'milk', '95 ml · Menyusu langsung'),
    c(5.1, 'temp', '36,7 °C'), c(7.8, 'milk', '120 ml · ASI perah'), c(8.2, 'diaper', 'Pipis + BAB'),
  ];
  // sesi tidur 7 hari terakhir (malam + tidur siang)
  const sleep = [];
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  for (let d = 7; d >= 0; d--) {
    const base = day0.getTime() - d * DAY;
    // jam relatif terhadap tengah malam: tidur malam (terpotong menyusu) + 3 kali tidur siang ≈ 13–14 jam/hari
    const plan = [[-4.6, -0.5], [0.1, 3.2], [3.6, 6.4], [9.2, 10.6], [13.1, 14.6], [17.0, 17.8]];
    plan.forEach(([a, b], i) => {
      const j = Math.sin(d * 7 + i) * 0.2;
      const start = base + (a + j) * HOUR, end = base + (b + j * 0.5) * HOUR;
      if (end < now - 10 * MIN) sleep.push({ id: 's' + uid(), start, end, seed: true });
    });
  }
  s.sleep = sleep.sort((a, b) => a.start - b.start);
  s.growth = [
    { id: 'g1', date: isoDaysAgo(128), weight: 3.2, height: 49.5, head: 34.5, note: 'Lahir' },
    { id: 'g2', date: isoDaysAgo(98), weight: 4.2, height: 53.6, head: 36.9, note: 'Imunisasi BCG' },
    { id: 'g3', date: isoDaysAgo(68), weight: 5.1, height: 57.1, head: 38.6, note: '' },
    { id: 'g4', date: isoDaysAgo(38), weight: 5.9, height: 60.3, head: 40.0, note: 'Mulai tengkurap' },
    { id: 'g5', date: isoDaysAgo(6), weight: 6.5, height: 62.6, head: 41.0, note: 'Posyandu' },
  ].map(g => ({ ...g, seed: true }));
  s.milestones = { smile: true, headUp: true, rollOver: true };
  s.baby.name = 'Aisyah';
  s.baby.demo = true;
}

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function merge(base, over) {
  if (!isObj(over)) return base;
  for (const k of Object.keys(over)) {
    if (isObj(base[k]) && isObj(over[k])) merge(base[k], over[k]);
    else if (over[k] !== undefined) base[k] = over[k];
  }
  return base;
}

/** Ambil data penting dari versi lama (v1) supaya pengguna tidak kehilangan catatan. */
function migrateLegacy() {
  try {
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (!old) return null;
    const s = defaults();
    seedDemo(s);
    if (old.baby) Object.assign(s.baby, { name: old.baby.name || s.baby.name, birth: old.baby.birth || s.baby.birth, gender: old.baby.gender || 'P', photo: old.baby.photo || null, note: old.baby.note || '', demo: false });
    if (old.user?.name) s.parentName = old.user.name.split(' ')[0];
    if (Array.isArray(old.careLog)) s.care = old.careLog.map(c => ({ id: c.id || 'c' + uid(), type: c.type, detail: c.detail, ts: c.ts, by: c.by || 'Bunda' }));
    if (Array.isArray(old.growthLog)) s.growth = old.growthLog.map(g => ({ id: g.id || 'g' + uid(), date: g.date, weight: g.weight, height: g.height, head: g.head, note: g.note || '' }));
    if (old.milestones) s.milestones = old.milestones;
    s.onboarded = true;
    return s;
  } catch { return null; }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) return merge(defaults(), raw);
  } catch { /* data rusak: mulai baru */ }
  const legacy = migrateLegacy();
  if (legacy) return legacy;
  const s = defaults();
  seedDemo(s);
  return s;
}

let s = load();
let timer = null;

function saveNow() {
  clearTimeout(timer); timer = null;
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch {
    // kuota penuh: buang cuplikan lama lalu coba lagi
    s.events.forEach((e, i) => { if (i > 5) delete e.snap; });
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* menyerah dengan tenang */ }
  }
}
window.addEventListener('pagehide', () => timer && saveNow());

export const store = {
  get s() { return s; },
  save() { clearTimeout(timer); timer = setTimeout(saveNow, 200); },
  saveNow,
  get(path) { return path.split('.').reduce((o, k) => o?.[k], s); },
  set(path, val) {
    const keys = path.split('.');
    let o = s;
    keys.slice(0, -1).forEach(k => { if (!isObj(o[k])) o[k] = {}; o = o[k]; });
    o[keys.at(-1)] = val;
    this.save();
    bus.emit('store', path);
  },

  addEvent(ev) {
    s.events.unshift(ev);
    if (s.events.length > MAX_EVENTS) s.events.length = MAX_EVENTS;
    s.events.forEach((e, i) => { if (i >= MAX_SNAPS) delete e.snap; });
    this.save();
    bus.emit('events');
  },
  addCare(type, detail) {
    const item = { id: 'c' + uid(), type, detail, ts: Date.now(), by: s.parentName || 'Bunda' };
    s.care.unshift(item);
    this.save();
    bus.emit('care');
    return item;
  },
  /** Peringatan yang belum dicek orang tua */
  unread() { return s.events.filter(e => !e.ack && e.level !== 'info').length; },

  get hasSeed() { return !!s.baby.demo || s.events.some(e => e.seed) || s.care.some(c => c.seed); },
  /** Hapus semua data contoh (dipakai saat mulai memantau bayi sungguhan). */
  clearSeed() {
    for (const k of ['events', 'care', 'sleep', 'growth']) s[k] = s[k].filter(x => !x.seed);
    if (s.baby.demo) { s.baby = { ...s.baby, name: 'Si Kecil', photo: null, demo: false }; s.milestones = {}; }
    this.save();
    bus.emit('events'); bus.emit('care'); bus.emit('sleep');
  },
  reset() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* */ }
    s = defaults();
    seedDemo(s);
    saveNow();
  },
};
