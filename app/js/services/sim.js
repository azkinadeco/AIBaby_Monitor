/* MODE DEMO — bayi simulasi.
   Menggambar "kamera" kamar bayi di canvas dan menghasilkan bacaan sensor tiruan,
   supaya seluruh aplikasi bisa dicoba tanpa perangkat kedua. */
import { lerp, pad2 } from '../core/util.js';
import { bus } from '../core/bus.js';

export const SIM_STATES = {
  sleep: { label: 'Tidur', icon: 'moon', tone: 'ok' },
  awake: { label: 'Bangun', icon: 'sun', tone: 'info' },
  cry: { label: 'Menangis', icon: 'volume', tone: 'warn' },
  move: { label: 'Gelisah', icon: 'move', tone: 'warn' },
  prone: { label: 'Tengkurap', icon: 'rotate', tone: 'bad' },
  vomit: { label: 'Muntah', icon: 'droplet', tone: 'bad' },
  distress: { label: 'Napas abnormal', icon: 'wind', tone: 'bad' },
};
const PROFILES = {
  sleep: { m: [1, 5], lv: [8, 16], rpm: [30, 36] },
  awake: { m: [16, 30], lv: [22, 34], rpm: [36, 44] },
  cry: { m: [30, 50], lv: [72, 90], rpm: [48, 58] },
  move: { m: [62, 90], lv: [26, 38], rpm: [40, 50] },
  prone: { m: [6, 14], lv: [10, 18], rpm: [34, 42] },
  vomit: { m: [24, 40], lv: [40, 55], rpm: [44, 54] },
  distress: { m: [2, 8], lv: [14, 22], rpm: [62, 74] },
};
const rnd = ([a, b]) => a + Math.random() * (b - a);

export const sim = {
  state: 'sleep', since: Date.now(),
  camOnline: true, hotRoom: false, forceNight: null, overlay: true,
  r: { level: 12, motion: 3, rpm: 33, temp: 25.4, hum: 54 },

  set(state) {
    this.state = state; this.since = Date.now();
    bus.emit('sim', this);
  },
  setCamera(on) { this.camOnline = on; bus.emit('sim', this); },

  /** Bacaan sensor tiruan (dipanggil Monitor tiap detik). */
  read() {
    const P = PROFILES[this.state], k = .4, r = this.r;
    r.level = lerp(r.level, rnd(P.lv), k);
    r.motion = lerp(r.motion, rnd(P.m), k);
    r.rpm = lerp(r.rpm, rnd(P.rpm), k * .8);
    r.temp = +lerp(r.temp, this.hotRoom ? rnd([29.2, 30.6]) : rnd([24.8, 25.8]), .2).toFixed(1);
    r.hum = Math.round(lerp(r.hum, this.hotRoom ? rnd([68, 75]) : rnd([50, 56]), .2));
    if (!this.camOnline) return { online: false };
    return {
      online: true,
      level: r.level,
      cry: this.state === 'cry' ? .75 + Math.random() * .25 : Math.random() * .08,
      motion: r.motion,
      rpm: r.rpm,
      prone: this.state === 'prone',
      vomit: this.state === 'vomit',
      temp: r.temp, hum: r.hum,
    };
  },
};

/* ---------------- Demo otomatis ---------------- */
const DEMO_SEQ = ['awake', 'cry', 'move', 'prone', 'cry', 'vomit', 'awake', 'distress'];
let demoIdx = 0, demoTimer = null, demoBack = null;
export const autoDemo = {
  on: false,
  set(v) {
    this.on = v;
    clearTimeout(demoTimer); clearTimeout(demoBack);
    if (v) this.next();
    bus.emit('sim', sim);
  },
  next() {
    demoTimer = setTimeout(() => {
      if (!this.on) return;
      const st = DEMO_SEQ[demoIdx++ % DEMO_SEQ.length];
      sim.set(st);
      demoBack = setTimeout(() => { if (this.on && sim.state === st) sim.set('sleep'); this.next(); }, 14000);
    }, 16000 + Math.random() * 8000);
  },
};

/* ================= Gambar kamera simulasi ================= */
const W = 640, H = 400;
const off = document.createElement('canvas');
off.width = W; off.height = H;
const c = off.getContext('2d');
const targets = new Set();
let holds = 0;
let breathPhase = 0, lastT = 0, lastFrame = 0, night = false, label = '';

export const simCam = {
  W, H, canvas: off,
  attach(cv) { targets.add(cv); return () => targets.delete(cv); },
  /** Tetap menggambar walau tidak ditampilkan (dipakai perekam klip). */
  hold() { holds++; return () => { holds = Math.max(0, holds - 1); }; },
  set night(v) { night = v; },
  get night() { return night; },
  set label(v) { label = v; },
  snapshot(w = 320, q = .7) {
    draw(performance.now() / 1000);
    const s = document.createElement('canvas');
    s.width = w; s.height = Math.round(w * H / W);
    s.getContext('2d').drawImage(off, 0, 0, s.width, s.height);
    return s.toDataURL('image/jpeg', q);
  },
};

function rr(x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const ell = (x, y, rx, ry, fill, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };
const circ = (x, y, r, fill) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };

function star(x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath(); c.fill();
}
function teddy(x, y) {
  const b = '#c99a6b', d = '#a77a4f';
  circ(x - 17, y - 22, 10, b); circ(x + 17, y - 22, 10, b);
  circ(x - 17, y - 22, 5, d); circ(x + 17, y - 22, 5, d);
  ell(x, y + 26, 24, 22, b); circ(x, y, 22, b); ell(x, y + 7, 9, 7, '#e3c39e');
  circ(x - 7, y - 4, 2.6, '#3a2a1e'); circ(x + 7, y - 4, 2.6, '#3a2a1e'); circ(x, y + 5, 2.6, '#3a2a1e');
}

// latar kamar (statis) digambar sekali lalu dipakai ulang tiap frame — jauh lebih hemat CPU
const roomCv = document.createElement('canvas');
roomCv.width = W; roomCv.height = H;
let roomReady = false;
function room() {
  if (!roomReady) {
    c.fillStyle = '#7d624d'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2;
    for (let y = 0; y < H; y += 46) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = '#eadcc8'; rr(36, 26, 568, 348, 18); c.fill();
    c.fillStyle = '#d9c6ab'; rr(46, 36, 548, 328, 14); c.fill();
    const g = c.createLinearGradient(0, 56, 0, 344);
    g.addColorStop(0, '#f7f4ef'); g.addColorStop(1, '#ebe5dc');
    c.fillStyle = g; rr(60, 54, 520, 292, 12); c.fill();
    c.fillStyle = 'rgba(126,150,214,.28)';
    for (let y = 74; y < 340; y += 34) for (let x = 78 + ((y / 34) % 2) * 17; x < 572; x += 34) star(x, y, 4);
    c.fillStyle = '#cbb495';
    for (let x = 64; x < 580; x += 30) { rr(x, 28, 9, 24, 4); c.fill(); rr(x, 348, 9, 24, 4); c.fill(); }
    teddy(530, 96);
    roomCv.getContext('2d').drawImage(off, 0, 0);
    roomReady = true;
  }
  c.drawImage(roomCv, 0, 0);
}

const SKIN = '#f2c7a2', SKIN_D = '#e2ad86', HAIR = '#5c3f2b', SUIT = '#9cbff0', SUIT_D = '#7fa6dd', BLANKET = '#f5c6d4';
function arm(sx, sy, ex, ey, hx, hy) {
  c.strokeStyle = SUIT; c.lineWidth = 24; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(ex, ey, hx, hy); c.stroke();
  circ(hx, hy, 12, SKIN); circ(hx - 3, hy - 2, 3, SKIN_D);
}

function baby(t, st) {
  const breath = Math.sin(breathPhase);
  let ox = 0, oy = 0, rot = 0;
  if (st === 'move') { ox = Math.sin(t * 3.1) * 20; oy = Math.cos(t * 2.3) * 15; rot = Math.sin(t * 1.7) * .2; }
  else if (st === 'cry') { ox = Math.sin(t * 11) * 2.2; rot = Math.sin(t * 6) * .045; }
  else if (st === 'awake') rot = Math.sin(t * .9) * .06;
  else if (st === 'prone') { rot = .22; ox = 10; oy = 8; }
  else if (st === 'vomit') rot = Math.sin(t * 4) * .03;

  const cx = 300 + ox, cy = 200 + oy;
  c.save(); c.translate(cx, cy); c.rotate(rot);
  ell(30, 10, 200, 92, 'rgba(60,40,20,.10)');
  const prone = st === 'prone';
  const k = 1 + breath * (st === 'distress' ? .055 : .03);

  let la, ra;
  if (st === 'sleep' || st === 'distress' || prone) { la = [-150, -62]; ra = [-150, 62]; }
  else if (st === 'cry') { la = [-120 + Math.sin(t * 9) * 26, -86 + Math.cos(t * 7) * 12]; ra = [-115 + Math.cos(t * 8) * 26, 86 + Math.sin(t * 10) * 12]; }
  else if (st === 'move') { la = [-100 + Math.sin(t * 6) * 30, -92]; ra = [-90 + Math.cos(t * 5) * 30, 92]; }
  else if (st === 'vomit') { la = [-80, -78]; ra = [-80, 78]; }
  else { la = [-110 + Math.sin(t * 2.4) * 14, -86]; ra = [-40 + Math.cos(t * 2) * 10, 84]; }

  ell(10, 0, 108, 62 * k, SUIT);
  if (prone) { c.strokeStyle = SUIT_D; c.lineWidth = 3; c.beginPath(); c.moveTo(-70, 0); c.lineTo(110, 0); c.stroke(); }
  else { ell(-55, 0, 18, 30, '#c4dbf8'); circ(-20, -8, 3.5, '#fff'); circ(-20, 8, 3.5, '#fff'); }
  arm(-60, -46, (-60 + la[0]) / 2, la[1] - 6, la[0], la[1]);
  arm(-60, 46, (-60 + ra[0]) / 2, ra[1] + 6, ra[0], ra[1]);

  // selimut naik-turun mengikuti napas
  const bTop = -78 * k, bBot = 78 * k, kick = (st === 'move' || prone) ? 60 : 0;
  c.save();
  c.beginPath();
  c.moveTo(30 + kick, bTop);
  for (let y = bTop; y <= bBot; y += 12) c.lineTo(30 + kick + Math.sin(y * .15) * 4, y);
  c.lineTo(200, bBot + 4); c.quadraticCurveTo(214, 0, 200, bTop - 4); c.closePath();
  c.fillStyle = BLANKET; c.fill(); c.clip();
  for (let x = 40; x < 210; x += 20) for (let y = -90; y < 90; y += 20) circ(x + kick, y + ((x / 20) % 2) * 10, 3, 'rgba(255,255,255,.55)');
  c.restore();
  c.strokeStyle = '#e9a8bc'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(32 + kick, bTop); c.lineTo(32 + kick, bBot); c.stroke();

  const hx = -125, hy = 0, hr = 50;
  if (prone) {
    circ(hx, hy, hr, SKIN);
    circ(hx + 4, hy - 47, 10, SKIN); circ(hx + 4, hy + 47, 10, SKIN);
    c.beginPath(); c.arc(hx, hy, hr, Math.PI * .32, Math.PI * 1.68); c.closePath(); c.fillStyle = HAIR; c.fill();
    circ(hx - 6, hy, hr * .78, HAIR);
    c.strokeStyle = '#46301f'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(hx - 14, hy, 12, 0, Math.PI * 1.6); c.stroke();
  } else {
    circ(hx + 2, hy - 49, 10, SKIN); circ(hx + 2, hy + 49, 10, SKIN);
    const g = c.createRadialGradient(hx + 10, hy - 10, 10, hx, hy, hr);
    g.addColorStop(0, '#f8d6b8'); g.addColorStop(1, SKIN);
    circ(hx, hy, hr, g);
    if (st === 'distress') circ(hx, hy, hr, 'rgba(110,140,220,.28)');
    c.beginPath(); c.arc(hx, hy, hr, Math.PI * .62, Math.PI * 1.38); c.closePath(); c.fillStyle = HAIR; c.fill();
    face(t, st, hx, hy);
  }
  if (st === 'vomit') {
    c.fillStyle = 'rgba(238,228,170,.95)';
    c.beginPath();
    c.moveTo(hx + 32, hy + 4);
    c.bezierCurveTo(hx + 60, hy + 40, hx + 30, hy + 80, hx - 6, hy + 92);
    c.bezierCurveTo(hx - 30, hy + 98, hx - 10, hy + 62, hx + 10, hy + 46);
    c.closePath(); c.fill();
    circ(hx + 40, hy + 70, 9, 'rgba(238,228,170,.9)');
  }
  c.restore();
  return { cx, cy };
}

function face(t, st, hx, hy) {
  const ex = hx - 2, eyY = 18;
  c.lineCap = 'round';
  circ(hx + 18, hy - 28, 9, 'rgba(240,120,130,.28)');
  circ(hx + 18, hy + 28, 9, 'rgba(240,120,130,.28)');
  if (st === 'cry') {
    c.strokeStyle = '#4a2f22'; c.lineWidth = 3.5;
    [-1, 1].forEach(s => { c.beginPath(); c.moveTo(ex - 6, hy + s * eyY - 6); c.lineTo(ex + 2, hy + s * eyY); c.lineTo(ex - 6, hy + s * eyY + 6); c.stroke(); });
    circ(hx + 14, hy - 36 + Math.sin(t * 4) * 2, 4, 'rgba(120,190,255,.9)');
    circ(hx + 20, hy + 37 + Math.cos(t * 4) * 2, 4, 'rgba(120,190,255,.9)');
  } else if (st === 'awake' || st === 'move' || st === 'vomit') {
    const blink = (t % 3.2) < .12;
    [-1, 1].forEach(s => {
      if (blink) { c.strokeStyle = '#4a2f22'; c.lineWidth = 3; c.beginPath(); c.moveTo(ex - 5, hy + s * eyY); c.lineTo(ex + 5, hy + s * eyY); c.stroke(); }
      else { ell(ex, hy + s * eyY, 6.5, 5.5, '#3a271c'); circ(ex - 2, hy + s * eyY - 2, 1.8, '#fff'); }
    });
  } else {
    c.strokeStyle = '#4a2f22'; c.lineWidth = 3;
    [-1, 1].forEach(s => { c.beginPath(); c.arc(ex - 4, hy + s * eyY, 7, -Math.PI / 2.4, Math.PI / 2.4); c.stroke(); });
  }
  ell(hx + 16, hy, 3.5, 4.5, SKIN_D);
  const mx = hx + 30;
  if (st === 'cry') { const open = 10 + Math.abs(Math.sin(t * 6)) * 4; ell(mx, hy, open * .8, 12, '#8e2f36'); ell(mx + 3, hy, 4, 6, '#e0707a'); }
  else if (st === 'vomit') ell(mx, hy, 6, 9, '#8e2f36');
  else if (st === 'distress') ell(mx, hy, 4, 7, '#6d74b8');
  else { c.strokeStyle = '#b5615c'; c.lineWidth = 3; c.beginPath(); c.arc(mx - (st === 'awake' ? 6 : 4), hy, st === 'awake' ? 9 : 5, -Math.PI / 3, Math.PI / 3); c.stroke(); }
}

function hud(pos) {
  const d = new Date();
  const ts = `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  c.font = '600 14px ui-monospace, Menlo, monospace';
  c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,.4)'; rr(12, H - 34, c.measureText(ts).width + 16, 24, 6); c.fill();
  c.fillStyle = 'rgba(255,255,255,.92)'; c.fillText(ts, 20, H - 21.5);
  if (label) {
    const w = c.measureText(label).width + 16;
    c.fillStyle = 'rgba(0,0,0,.4)'; rr(W - w - 12, H - 34, w, 24, 6); c.fill();
    c.fillStyle = 'rgba(255,255,255,.92)'; c.fillText(label, W - w - 4, H - 21.5);
  }
  if (!sim.overlay || !pos) return;
  const alert = !['sleep', 'awake'].includes(sim.state);
  c.strokeStyle = alert ? 'rgba(255,110,110,.95)' : 'rgba(140,240,200,.85)'; c.lineWidth = 3;
  const bx = pos.cx - 200, by = pos.cy - 112, bw = 420, bh = 224, L = 22;
  [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach(([x, y, sx, sy]) => {
    c.beginPath(); c.moveTo(x + sx * L, y); c.lineTo(x, y); c.lineTo(x, y + sy * L); c.stroke();
  });
}

function offline() {
  c.fillStyle = '#14151d'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 1800; i++) {
    const v = Math.random() * 80 | 0;
    c.fillStyle = `rgb(${v},${v},${v})`;
    c.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
}

function draw(t) {
  const dt = Math.min(.1, t - lastT); lastT = t;
  breathPhase += dt * 2 * Math.PI * (sim.r.rpm / 60);
  if (!sim.camOnline) { offline(); return; }
  room();
  const pos = baby(t, sim.state);
  if (night) {
    c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'multiply'; c.fillStyle = '#b8c4bf'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgb(40,46,44)'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    const vg = c.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 420);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  hud(pos);
}

function loop(ts) {
  requestAnimationFrame(loop);
  const busy = targets.size || holds;
  if (!busy || document.hidden || ts - lastFrame < 50) { if (!busy) lastT = ts / 1000; return; }   // ±20 fps, hanya saat dibutuhkan
  lastFrame = ts;
  draw(ts / 1000);
  targets.forEach(cv => {
    if (!cv.isConnected) { targets.delete(cv); return; }
    if (cv.width !== W) { cv.width = W; cv.height = H; }
    cv.getContext('2d').drawImage(off, 0, 0);
  });
}
requestAnimationFrame(loop);
