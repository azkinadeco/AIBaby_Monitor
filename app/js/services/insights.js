/* WAWASAN — mengolah data mentah menjadi jawaban yang dicari orang tua:
   "Semalam tidurnya bagaimana?", "Kapan sebaiknya ditidurkan lagi?", "Kapan menyusu berikutnya?" */
import { store } from '../core/store.js';
import { HOUR, MIN, DAY, babyMonths } from '../core/util.js';
import { sleptBetween, openSession } from './monitor.js';

/* ---------------- Laporan semalam (18.00 → 07.00) ---------------- */
export function nightWindow(now = Date.now()) {
  const d = new Date(now), h = d.getHours();
  const at = (base, hour) => { const x = new Date(base); x.setHours(hour, 0, 0, 0); return x.getTime(); };
  if (h >= 18) return { start: at(now, 18), end: now, live: true, label: 'Malam ini' };
  const start = at(now - DAY, 18), end = Math.min(now, at(now, 7));
  return { start, end, live: now < at(now, 7), label: 'Semalam' };
}

export function nightReport(win = nightWindow()) {
  const s = store.s, { start, end } = win;
  const clip = x => [Math.max(start, x.start), Math.min(end, x.end || Date.now())];
  const sessions = s.sleep.filter(x => (x.end || Date.now()) > start && x.start < end).map(clip).filter(([a, b]) => b - a > 2 * MIN);
  const total = sleptBetween(start, end);
  const longest = sessions.reduce((m, [a, b]) => Math.max(m, b - a), 0);
  // terbangun = jeda > 5 menit di antara dua sesi tidur
  let wakes = 0;
  for (let i = 1; i < sessions.length; i++) if (sessions[i][0] - sessions[i - 1][1] > 5 * MIN) wakes++;
  const inWin = ts => ts >= start && ts < end;
  const alerts = s.events.filter(e => e.level !== 'info' && inWin(e.ts));
  const feeds = s.care.filter(c => c.type === 'milk' && inWin(c.ts));
  const diapers = s.care.filter(c => c.type === 'diaper' && inWin(c.ts));

  // aktivitas per 15 menit: suara tertinggi, gerakan rata-rata, ada tangisan?
  const BUCKET = 15, m0 = Math.floor(start / MIN), m1 = Math.floor(end / MIN);
  const n = Math.max(1, Math.ceil((m1 - m0) / BUCKET));
  const buckets = Array.from({ length: n }, () => ({ lv: 0, mo: 0, k: 0, cry: 0 }));
  for (const [m, lv, mo, cry] of s.activity) {
    if (m < m0 || m >= m1) continue;
    const b = buckets[Math.floor((m - m0) / BUCKET)];
    b.lv = Math.max(b.lv, lv); b.mo += mo; b.k++; b.cry ||= cry;
  }
  buckets.forEach(b => { b.mo = b.k ? b.mo / b.k : 0; });

  const span = end - start;
  return {
    ...win, total, longest, wakes, sessions, alerts, feeds, diapers, buckets,
    hasData: sessions.length > 0 || buckets.some(b => b.k),
    efficiency: span ? total / span : 0,
    bedtime: sessions[0]?.[0] ?? null,
    wakeUp: sessions.length && !win.live ? sessions.at(-1)[1] : null,
  };
}

/** Kalimat ringkas & bisa dibagikan ke pasangan/keluarga */
export function reportText(r, babyName, fmtDur, fmtTime) {
  const lines = [
    `🌙 Laporan tidur ${babyName} — ${r.label.toLowerCase()}`,
    `Total tidur: ${fmtDur(r.total)} · terpanjang ${fmtDur(r.longest)}`,
    `Terbangun: ${r.wakes}× · menyusu ${r.feeds.length}× · popok ${r.diapers.length}×`,
  ];
  if (r.bedtime) lines.push(`Mulai tidur ${fmtTime(r.bedtime)}${r.wakeUp ? ` · bangun ${fmtTime(r.wakeUp)}` : ''}`);
  lines.push(r.alerts.length ? `Peringatan: ${r.alerts.length} (sudah dicek ${r.alerts.filter(e => e.ack).length})` : 'Tidak ada peringatan ✨');
  return lines.join('\n');
}

/* ---------------- Jendela tidur (wake window) menurut usia ---------------- */
// rentang lama bangun yang umum (menit) — panduan umum, tiap bayi bisa berbeda
const WAKE = [[1, 35, 60], [3, 60, 90], [5, 75, 120], [8, 120, 180], [11, 150, 210], [15, 180, 240], [24, 240, 330], [99, 300, 360]];
export function wakeWindow() {
  const months = babyMonths(store.s.baby.birth);
  const [, lo, hi] = WAKE.find(([m]) => months < m);
  const open = openSession();
  if (open) return { asleep: true, since: open.start, lo, hi };
  const last = [...store.s.sleep].filter(x => x.end).sort((a, b) => b.end - a.end)[0];
  if (!last || Date.now() - last.end > 10 * HOUR) return { asleep: false, since: null, lo, hi };
  const awake = Date.now() - last.end;
  return { asleep: false, since: last.end, awake, lo, hi, from: last.end + lo * MIN, to: last.end + hi * MIN, pct: awake / (hi * MIN) };
}

/* ---------------- Jadwal menyusu ---------------- */
export function nextFeed() {
  const every = store.s.settings.feedEvery;
  const last = store.s.care.find(c => c.type === 'milk');
  if (!every || !last) return null;
  return { last, at: last.ts + every * MIN, due: Date.now() >= last.ts + every * MIN };
}
