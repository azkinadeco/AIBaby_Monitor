/* Helper umum: DOM, format waktu Bahasa Indonesia, angka, unduhan, wake lock. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const uid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);
export const pad2 = n => String(n).padStart(2, '0');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export const MIN = 60000, HOUR = 3600000, DAY = 86400000;
export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const fmtTime = ts => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export const fmtTimeS = ts => { const d = new Date(ts); return `${fmtTime(ts)}:${pad2(d.getSeconds())}`; };
export const isToday = ts => new Date(ts).toDateString() === new Date().toDateString();

export function fmtDay(ts) {
  const d = new Date(ts), y = new Date(Date.now() - DAY);
  if (isToday(ts)) return 'Hari ini';
  if (d.toDateString() === y.toDateString()) return 'Kemarin';
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
}

/** Durasi singkat: 2j 15m · 45m · 30d */
export function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h}j ${m}m`;
  if (m) return `${m}m`;
  return `${s} dtk`;
}

export function fmtAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${fmtDur(s * 1000)} lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

export function babyAge(birth) {
  const b = new Date(birth), n = new Date();
  if (isNaN(b)) return '';
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  let days = n.getDate() - b.getDate();
  if (days < 0) { months--; days += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
  if (months < 0) return 'baru lahir';
  if (months >= 24) return `${Math.floor(months / 12)} tahun ${months % 12} bulan`;
  return months ? `${months} bulan ${days} hari` : `${days} hari`;
}
export const babyMonths = birth => Math.max(0, (Date.now() - new Date(birth)) / (30.44 * DAY));

export const isNightHour = (h = new Date().getHours()) => h >= 18 || h < 6;

/** Menit-dalam-hari dari "HH:MM" */
export const hm = str => { const [h, m] = String(str).split(':').map(Number); return h * 60 + (m || 0); };
export function inRange(from, to, d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes(), f = hm(from), t = hm(to);
  return f <= t ? m >= f && m < t : m >= f || m < t;
}

export function download(data, filename, type = 'application/octet-stream') {
  const url = typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  if (!url.startsWith('data:')) setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const scripts = {};
/** Muat skrip eksternal sekali saja (dipakai untuk PeerJS & QR, hanya saat dibutuhkan). */
export function loadScript(src) {
  scripts[src] ??= new Promise((res, rej) => {
    const s = Object.assign(document.createElement('script'), { src, async: true, crossOrigin: 'anonymous' });
    s.onload = res;
    s.onerror = () => { delete scripts[src]; rej(new Error('Gagal memuat ' + src)); };
    document.head.appendChild(s);
  });
  return scripts[src];
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* tidak didukung */ }
}

/** Layar tetap menyala selama pemantauan (Wake Lock API). Diminta ulang saat tab kembali terlihat. */
export const WakeLock = (() => {
  let lock = null;
  const holders = new Set();
  async function acquire() {
    if (!holders.size || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { lock = null; }
  }
  document.addEventListener('visibilitychange', acquire);
  return {
    get supported() { return 'wakeLock' in navigator; },
    get active() { return !!lock; },
    hold(key) { holders.add(key); acquire(); },
    release(key) {
      holders.delete(key);
      if (!holders.size && lock) { lock.release().catch(() => {}); lock = null; }
    },
  };
})();

export async function sha256(text) {
  if (!crypto?.subtle) return text;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Kode pairing yang mudah dibaca (tanpa 0/O/1/I). */
export function readableCode(len = 6) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(len));
  return [...r].map(x => A[x % A.length]).join('');
}
export const digits = (len = 6) => [...crypto.getRandomValues(new Uint8Array(len))].map(x => x % 10).join('');
