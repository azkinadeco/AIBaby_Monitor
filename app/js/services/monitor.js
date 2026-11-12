/* MONITOR — otak aplikasi.
   Tiap detik: ambil bacaan dari sumber aktif → tentukan status bayi → picu kejadian → catat sesi tidur.
   Sumber:  'sim'    = bayi simulasi (mode demo)
            'local'  = kamera & mikrofon perangkat ini
            'remote' = kamera bayi di HP lain (lewat link WebRTC)                          */
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { avg, uid, MIN, isNightHour } from '../core/util.js';
import { sim, simCam } from './sim.js';
import { Detector } from './detector.js';
import { link } from './link.js';

export const localCam = new Detector();

export const TYPES = {
  cry: { label: 'Bayi menangis', short: 'Tangisan', level: 'warning', icon: 'volume', speak: n => `Perhatian. ${n} sedang menangis.` },
  motion: { label: 'Bayi gelisah', short: 'Gelisah', level: 'warning', icon: 'move', speak: n => `Perhatian. ${n} banyak bergerak dan gelisah.` },
  wake: { label: 'Bayi terbangun', short: 'Bangun', level: 'info', icon: 'sun', speak: n => `${n} sudah bangun.` },
  position: { label: 'Posisi tengkurap', short: 'Tengkurap', level: 'critical', icon: 'rotate', speak: n => `Peringatan darurat. ${n} terdeteksi tengkurap. Segera ke kamar bayi.` },
  vomit: { label: 'Indikasi muntah', short: 'Muntah', level: 'critical', icon: 'droplet', speak: n => `Peringatan darurat. Terdeteksi indikasi muntah pada ${n}. Segera ke kamar bayi.` },
  breath: { label: 'Napas tidak normal', short: 'Napas', level: 'critical', icon: 'wind', speak: n => `Peringatan darurat. Pola napas ${n} tidak normal. Segera periksa.` },
  link: { label: 'Kamera bayi terputus', short: 'Terputus', level: 'critical', icon: 'wifiOff', speak: () => 'Perhatian. Sambungan ke kamera bayi terputus. Mohon periksa kamera.' },
  battery: { label: 'Baterai kamera lemah', short: 'Baterai', level: 'warning', icon: 'batteryLow', speak: () => 'Baterai kamera bayi hampir habis. Mohon colokkan pengisi daya.' },
};

export const STATUS = {
  sleep: { text: 'Tidur nyenyak', tone: 'ok', icon: 'moon' },
  awake: { text: 'Bangun, tenang', tone: 'info', icon: 'sun' },
  active: { text: 'Gelisah', tone: 'warn', icon: 'move' },
  cry: { text: 'Menangis', tone: 'warn', icon: 'volume' },
  prone: { text: 'Tengkurap!', tone: 'bad', icon: 'rotate' },
  vomit: { text: 'Indikasi muntah', tone: 'bad', icon: 'droplet' },
  breath: { text: 'Napas tidak normal', tone: 'bad', icon: 'wind' },
  offline: { text: 'Kamera terputus', tone: 'muted', icon: 'wifiOff' },
  waiting: { text: 'Menyambungkan…', tone: 'muted', icon: 'link' },
  paused: { text: 'Pemantauan dijeda', tone: 'muted', icon: 'pause' },
};
/** Jenis kejadian yang memicu status tertentu */
const STATUS_EVENT = { cry: 'cry', active: 'motion', awake: 'wake', prone: 'position', vomit: 'vomit', breath: 'breath' };

/* Sensitivitas → ambang & lama bertahan (detik) */
const SENS = {
  tinggi: { cry: .3, active: 45, awake: 12, hold: 2, wakeHold: 5 },
  sedang: { cry: .45, active: 55, awake: 16, hold: 3, wakeHold: 8 },
  rendah: { cry: .6, active: 68, awake: 22, hold: 5, wakeHold: 12 },
};

const HIST = 90;
export const live = {
  source: 'sim', status: 'sleep', since: Date.now(),
  level: 0, cry: 0, motion: 0, rpm: null, temp: null, hum: null,
  bat: null, charging: null, latency: null, dark: false,
  hist: { level: [], motion: [] },
};

const win = { level: [], motion: [], cry: [] };   // jendela 15 detik
const held = {};                                    // berapa detik kondisi bertahan
let cand = null, candN = 0;                         // kandidat status berikutnya
const cooldown = {};                                // jeda antarkejadian per jenis
let offlineSince = 0, linkAlerted = false, batAlertAt = 0;

export function currentSource() {
  const m = store.s.mode;
  if (m === 'parent') return 'remote';
  if (m === 'baby') return 'local';
  return localCam.running ? 'local' : 'sim';
}
const isDemo = () => store.s.mode === 'demo';
const sensOf = type => SENS[store.s.settings.detect[type]?.sens] || SENS.sedang;

function readSource(src) {
  if (src === 'sim') return sim.read();
  if (src === 'local') return localCam.read();
  const r = link.lastReading;
  if (link.state !== 'connected' || !r || Date.now() - r.ts > 6000) return { online: false };
  return { online: true, ...r };
}

function classify(r) {
  if (!r.online) return 'offline';
  if (r.vomit) return 'vomit';
  if (r.prone) return 'prone';
  if (r.rpm != null && (r.rpm >= 60 || r.rpm <= 18)) return 'breath';
  const cryAvg = avg(win.cry.slice(-4)), mot5 = avg(win.motion.slice(-5)), mot12 = avg(win.motion.slice(-12));
  if (cryAvg >= sensOf('cry').cry) return 'cry';
  if (mot5 >= sensOf('motion').active) return 'active';
  if (mot12 >= sensOf('wake').awake) return 'awake';
  return 'sleep';
}

function push(arr, v, n) { arr.push(v); if (arr.length > n) arr.shift(); }

function tick() {
  const src = currentSource();
  if (src !== live.source) {
    live.source = src;
    Object.assign(live, { rpm: null, temp: null, hum: null, bat: null, charging: null });
    live.hist.level.length = live.hist.motion.length = 0;
    bus.emit('source', src);
  }
  const r = readSource(src);

  if (r.online) {
    push(win.level, r.level, 15); push(win.motion, r.motion, 15); push(win.cry, r.cry || 0, 15);
    Object.assign(live, {
      level: r.level, cry: r.cry || 0, motion: r.motion,
      rpm: r.rpm ?? null, temp: r.temp ?? null, hum: r.hum ?? null,
      bat: r.bat ?? null, charging: r.charging ?? null, dark: !!r.dark,
    });
    push(live.hist.level, r.level, HIST); push(live.hist.motion, r.motion, HIST);
  }
  live.latency = src === 'remote' ? link.latency : null;

  let next = classify(r);
  // belum tersambung, atau sudah tersambung tapi data pertama belum tiba → "Menyambungkan…", bukan "terputus"
  if (src === 'remote' && !r.online && (link.state !== 'connected' || !link.lastReading) && !offlineSince && !linkAlerted) next = 'waiting';
  // status bayi berubah hanya jika kondisi baru bertahan beberapa detik (hindari kedip-kedip)
  if (next === live.status) candN = 0;
  else {
    if (cand !== next) { cand = next; candN = 0; }
    const need = ['offline', 'waiting', 'vomit', 'prone', 'breath'].includes(next) ? 1 : next === 'sleep' ? 6 : 2;
    if (++candN >= need) {
      live.status = next; live.since = Date.now() - (need - 1) * 1000;
      candN = 0;
      bus.emit('status', live.status);
    }
  }

  if (store.s.mode !== 'baby') {
    detect(r, src);
    trackSleep();
    logActivity(r);
  }
  if (isDemo()) simCam.night = sim.forceNight ?? (store.s.settings.nightVision === 'on' || (store.s.settings.nightVision === 'auto' && isNightHour()));
  bus.emit('tick', live);
}

function detect(r, src) {
  const armed = store.s.armed !== false;
  const now = Date.now();

  // sambungan kamera bayi terputus → alarm (keselamatan: orang tua harus tahu monitor tidak bekerja)
  if (src === 'remote') {
    if (!r.online && (link.everConnected || offlineSince)) {
      offlineSince ||= now;
      if (!linkAlerted && now - offlineSince > 12000 && armed) { linkAlerted = true; raise('link'); }
    } else if (r.online) {
      if (linkAlerted) bus.emit('link:restored');
      offlineSince = 0; linkAlerted = false;
    }
    if (r.online && r.bat != null && r.bat < .15 && !r.charging && now - batAlertAt > 30 * MIN) { batAlertAt = now; raise('battery'); }
  }
  if (!r.online || !armed) return;

  const st = live.status;
  for (const type of Object.keys(store.s.settings.detect)) {
    const cfg = store.s.settings.detect[type];
    const active = STATUS_EVENT[st] === type;
    if (!cfg.on || !active) { held[type] = 0; continue; }
    held[type] = (held[type] || 0) + 1;
    const s = sensOf(type), need = type === 'wake' ? s.wakeHold : ['position', 'vomit', 'breath'].includes(type) ? Math.max(1, s.hold - 1) : s.hold;
    if (held[type] >= need && now > (cooldown[type] || 0)) {
      raise(type);
      cooldown[type] = now + (type === 'wake' ? 10 * MIN : 90 * 1000);
    }
  }
}

/** Kejadian setelah orang tua menangani: izinkan alarm berikutnya lebih cepat */
export function resetCooldowns() { Object.keys(cooldown).forEach(k => { if (k !== 'wake') cooldown[k] = Date.now() + 20000; }); }

export function raise(type, extra = {}) {
  const T = TYPES[type];
  const ev = {
    id: 'e' + Date.now().toString(36) + uid(3), type, level: T.level, ts: Date.now(),
    ack: T.level === 'info', src: live.source,
    metrics: { level: Math.round(live.level), motion: Math.round(live.motion), rpm: live.rpm ? Math.round(live.rpm) : null },
    snap: snapshot(), ...extra,
  };
  store.addEvent(ev);
  bus.emit('alert', ev);
  return ev;
}

/* ---------------- Snapshot dari sumber aktif ---------------- */
let remoteVideo = null;
export function setRemoteVideo(v) { remoteVideo = v; }
export function snapshot(w = 320, q = .7) {
  if (live.source === 'sim') return simCam.snapshot(w, q);
  const v = live.source === 'local' ? localCam.video : remoteVideo;
  if (!v || v.readyState < 2 || !v.videoWidth) return null;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = Math.round(w * v.videoHeight / v.videoWidth);
  cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', q);
}

/* ---------------- Sesi tidur otomatis ---------------- */
const SLEEP_START = () => (isDemo() ? 30 : 180) * 1000;   // tenang selama ini → mulai sesi tidur
const SLEEP_END = () => (isDemo() ? 30 : 120) * 1000;     // bangun selama ini → sesi selesai
let calmSince = 0, wakeSince = 0;

export const openSession = () => store.s.sleep.find(x => !x.end);

function trackSleep() {
  const now = Date.now(), st = live.status, open = openSession();
  const asleep = st === 'sleep', awake = ['awake', 'active', 'cry'].includes(st);
  calmSince = asleep ? (calmSince || live.since) : 0;
  wakeSince = awake ? (wakeSince || live.since) : 0;

  if (!open && asleep && now - calmSince >= SLEEP_START()) {
    store.s.sleep.push({ id: 's' + uid(), start: calmSince, end: null, last: now });
    store.save(); bus.emit('sleep');
  } else if (open) {
    if (awake && now - wakeSince >= SLEEP_END()) {
      open.end = wakeSince; delete open.last;
      store.save(); bus.emit('sleep');
    } else if (now - (open.last || 0) > 30000) { open.last = now; store.save(); }
  }
}

/** Sesi yang tertinggal terbuka (aplikasi ditutup saat bayi tidur) ditutup pada waktu terakhir terpantau. */
function closeStaleSession() {
  const open = openSession();
  if (open && Date.now() - (open.last || open.start) > 5 * MIN) { open.end = open.last || open.start; delete open.last; store.save(); }
}

/** Total tidur (ms) dalam rentang waktu */
export function sleptBetween(from, to = Date.now()) {
  return store.s.sleep.reduce((sum, x) => {
    const a = Math.max(from, x.start), b = Math.min(to, x.end || Date.now());
    return b > a ? sum + (b - a) : sum;
  }, 0);
}

/* ---------------- Log aktivitas per menit (untuk laporan semalam) ---------------- */
let minute = { m: 0, lv: 0, mo: 0, n: 0, cry: 0 };
function logActivity(r) {
  if (!r.online) return;
  const m = Math.floor(Date.now() / MIN);
  if (m !== minute.m) {
    if (minute.n) {
      const log = store.s.activity;
      log.push([minute.m, Math.round(minute.lv), Math.round(minute.mo / minute.n), minute.cry]);
      const cut = m - 48 * 60;
      while (log.length && log[0][0] < cut) log.shift();
      store.save();
    }
    minute = { m, lv: 0, mo: 0, n: 0, cry: 0 };
  }
  minute.lv = Math.max(minute.lv, r.level);
  minute.mo += r.motion; minute.n++;
  if (live.status === 'cry') minute.cry = 1;
}

export function setArmed(v) {
  store.s.armed = v; store.save();
  bus.emit('armed', v);
}

let started = false;
export function startMonitor() {
  if (started) return;
  started = true;
  closeStaleSession();
  setInterval(tick, 1000);
  tick();
}
