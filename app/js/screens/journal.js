/* JURNAL — riwayat kejadian, catatan perawatan, statistik tidur, dan tumbuh kembang. */
import { $, esc, fmtTime, fmtDay, fmtDur, fmtTimeS, HARI, DAY, babyMonths, babyAge, isToday, download } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { actions, sheet, closeSheet, toast, confirmBox, topbar, empty } from '../core/ui.js';
import { TYPES, sleptBetween } from '../services/monitor.js';
import { DESC } from '../services/alarm.js';
import { eventRow, groupByDay, timeline24, CARE, levelTone, levelLabel } from './shared.js';

const TABS = [['events', 'bell', 'Kejadian'], ['care', 'heart', 'Rawat'], ['sleep', 'moon', 'Tidur'], ['growth', 'ruler', 'Tumbuh']];

route('journal', {
  tab: 'journal',
  render({ tab = 'events', f = 'alert' }) {
    const body = tab === 'care' ? careTab() : tab === 'sleep' ? sleepTab() : tab === 'growth' ? growthTab() : eventsTab(f);
    return `<header class="top"><h1 class="title">Jurnal</h1>
      <div class="top-act"><button class="icon-btn soft" data-act="care" aria-label="Catat perawatan">${ic('plus', 20)}</button></div></header>
    <div class="stack">
      <nav class="tabs">${TABS.map(([k, i, l]) => `<button class="${k === tab ? 'on' : ''}" data-go="journal?tab=${k}" data-replace>${ic(i, 15)}${l}</button>`).join('')}</nav>
      ${body}
    </div>`;
  },
  mount(root, { tab = 'events' }) {
    const re = () => router.refresh();
    const offs = [bus.on('events', () => tab === 'events' && re()), bus.on('care', () => tab === 'care' && re()), bus.on('sleep', () => tab === 'sleep' && re())];
    return () => offs.forEach(f => f());
  },
});

/* ---------------- Kejadian ---------------- */
function eventsTab(f) {
  let list = store.s.events;
  if (f === 'alert') list = list.filter(e => e.level !== 'info');
  const pending = store.s.events.filter(e => !e.ack && e.level !== 'info').length;
  return `${pending ? `<button class="banner warn" data-act="ackAll">${ic('alert', 18)}<span><b>${pending} peringatan belum dicek</b><small>Ketuk untuk konfirmasi semua</small></span></button>` : ''}
    <div class="chips">
      <button class="chip ${f === 'alert' ? 'on' : ''}" data-go="journal?tab=events&f=alert" data-replace>Peringatan</button>
      <button class="chip ${f === 'all' ? 'on' : ''}" data-go="journal?tab=events&f=all" data-replace>Semua</button>
      <button class="chip end" data-act="exportCsv">${ic('download', 13)} CSV</button>
    </div>
    ${groupByDay(list).map(g => `<div class="day-h">${g.d}</div><div class="card list">${g.items.map(eventRow).join('')}</div>`).join('') || empty('bell', 'Belum ada kejadian')}`;
}

/* ---------------- Perawatan ---------------- */
function careTab() {
  const list = store.s.care, today = list.filter(c => isToday(c.ts));
  const cnt = t => today.filter(c => c.type === t).length;
  const ml = today.filter(c => c.type === 'milk').reduce((a, c) => a + (parseInt(c.detail, 10) || 0), 0);
  return `<div class="stats">
      <div class="stat"><span class="tone-pri">${ic('bottle', 18)}</span><b>${cnt('milk')}×</b><small>susu hari ini${ml ? ` · ${ml} ml` : ''}</small></div>
      <div class="stat"><span class="tone-info">${ic('diaper', 18)}</span><b>${cnt('diaper')}×</b><small>popok hari ini</small></div>
    </div>
    <div class="care-quick">${Object.entries(CARE).map(([k, v]) => `<button class="care-type tone-${v.tone}" data-act="care" data-t="${k}"><span>${ic(v.icon, 20)}</span><small>${v.label}</small></button>`).join('')}</div>
    ${groupByDay(list).map(g => `<div class="day-h">${g.d}</div><div class="card list">${g.items.map(c => {
      const T = CARE[c.type] || CARE.med;
      return `<div class="row">
        <span class="row-ic tone-${T.tone}">${ic(T.icon, 18)}</span>
        <span class="row-main"><b>${T.label} · ${esc(c.detail)}</b><small>${fmtTime(c.ts)} · ${esc(c.by || '')}</small></span>
        <button class="icon-btn sm" data-act="delCare" data-id="${c.id}" aria-label="Hapus">${ic('trash', 15)}</button>
      </div>`;
    }).join('')}</div>`).join('') || empty('heart', 'Belum ada catatan perawatan')}`;
}
actions.delCare = async el => {
  if (!await confirmBox('Hapus catatan?', 'Catatan ini akan dihapus dari jurnal.', 'Hapus', true)) return;
  store.s.care = store.s.care.filter(c => c.id !== el.dataset.id);
  store.save(); bus.emit('care');
};

/* ---------------- Tidur (dihitung dari sesi tidur nyata) ---------------- */
function sleepTab() {
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const from = day0.getTime() - i * DAY;
    days.push({ from, ms: sleptBetween(from, from + DAY), naps: store.s.sleep.filter(x => x.start >= from && x.start < from + DAY).length });
  }
  const done = days.slice(0, 6), avgMs = done.reduce((a, d) => a + d.ms, 0) / Math.max(1, done.filter(d => d.ms).length);
  const m = babyMonths(store.s.baby.birth);
  const rec = m < 4 ? [14, 17] : m < 12 ? [12, 16] : m < 24 ? [11, 14] : [10, 13];   // rekomendasi AASM/WHO
  const maxH = Math.max(rec[1] + 1, ...days.map(d => d.ms / 3600000));
  const longest = store.s.sleep.filter(x => x.end && x.end > Date.now() - 7 * DAY).reduce((a, x) => Math.max(a, x.end - x.start), 0);
  const week = store.s.events.filter(e => e.ts > Date.now() - 7 * DAY && e.level !== 'info');
  return `<div class="stats">
      <div class="stat"><span class="tone-ok">${ic('moon', 18)}</span><b>${fmtDur(avgMs)}</b><small>rata-rata / hari</small></div>
      <div class="stat"><span class="tone-pri">${ic('bed', 18)}</span><b>${fmtDur(longest)}</b><small>tidur terpanjang</small></div>
      <div class="stat"><span class="tone-warn">${ic('alert', 18)}</span><b>${week.length}</b><small>peringatan 7 hari</small></div>
    </div>
    <div class="card">
      <div class="card-h"><b>Durasi tidur 7 hari</b><small>area hijau = anjuran usia ${Math.floor(m)} bln (${rec[0]}–${rec[1]} j)</small></div>
      <div class="cols">${days.map((d, i) => {
        const h = d.ms / 3600000;
        return `<div class="col ${i === 6 ? 'today' : ''}"><em>${h ? h.toFixed(1) : '–'}</em>
          <div class="col-track"><span class="col-rec" style="bottom:${rec[0] / maxH * 100}%;height:${(rec[1] - rec[0]) / maxH * 100}%"></span><i style="height:${Math.min(100, h / maxH * 100)}%"></i></div>
          <small>${i === 6 ? 'Kini' : HARI[new Date(d.from).getDay()].slice(0, 3)}</small></div>`;
      }).join('')}</div>
    </div>
    <div class="card"><div class="card-h"><b>24 jam terakhir</b></div>${timeline24()}</div>
    <div class="sec-h"><h3>Sesi tidur</h3></div>
    <div class="card list">${store.s.sleep.slice(-8).reverse().map(x => `<div class="row">
      <span class="row-ic tone-ok">${ic(x.end ? 'moon' : 'moonStar', 18)}</span>
      <span class="row-main"><b>${fmtTime(x.start)} – ${x.end ? fmtTime(x.end) : 'sekarang'}</b><small>${fmtDay(x.start)}</small></span>
      <b class="mono">${fmtDur((x.end || Date.now()) - x.start)}</b></div>`).join('') || `<p class="muted small pad-s">Sesi tidur tercatat otomatis saat bayi tenang beberapa menit.</p>`}</div>
    <button class="btn btn-soft btn-lg" data-act="printReport">${ic('download', 18)} Laporan untuk dokter anak (PDF)</button>`;
}

/* ---------------- Tumbuh kembang ---------------- */
// Median berat badan menurut umur (kg), WHO Child Growth Standards 0–12 bulan
const WHO_W = {
  P: [3.2, 4.2, 5.1, 5.8, 6.4, 6.9, 7.3, 7.6, 7.9, 8.2, 8.5, 8.7, 8.9],
  L: [3.3, 4.5, 5.6, 6.4, 7.0, 7.5, 7.9, 8.3, 8.6, 8.9, 9.2, 9.4, 9.6],
};
const MILESTONES = [
  ['smile', 'Tersenyum saat diajak bicara', '1–2 bln'], ['headUp', 'Mengangkat kepala saat tengkurap', '2–3 bln'],
  ['rollOver', 'Berguling', '3–5 bln'], ['babble', 'Mengoceh', '4–6 bln'], ['sit', 'Duduk tanpa bantuan', '6–8 bln'],
  ['crawl', 'Merangkak', '7–10 bln'], ['stand', 'Berdiri berpegangan', '9–12 bln'], ['walk', 'Berjalan sendiri', '12–15 bln'],
];
const monthAt = date => Math.max(0, (new Date(date) - new Date(store.s.baby.birth)) / (30.44 * DAY));

function growthChart(list) {
  const W = 320, H = 150, P = 26, med = WHO_W[store.s.baby.gender] || WHO_W.P;
  const maxM = Math.max(6, Math.ceil(Math.max(...list.map(g => monthAt(g.date)), babyMonths(store.s.baby.birth))) + 1);
  const maxW = Math.ceil(Math.max(...list.map(g => g.weight), med[Math.min(12, maxM)] || 9) + 1);
  const x = m => P + (m / maxM) * (W - P - 8), y = kg => H - 18 - (kg / maxW) * (H - 30);
  const medPts = med.slice(0, Math.min(13, maxM + 1)).map((v, m) => `${x(m)},${y(v)}`).join(' ');
  const pts = list.map(g => [x(monthAt(g.date)), y(g.weight), g.weight]);
  const grid = [0, Math.round(maxW / 2), maxW].map(v => `<line x1="${P}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}"/><text x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const xl = Array.from({ length: maxM + 1 }, (_, m) => m).filter(m => m % 2 === 0).map(m => `<text x="${x(m)}" y="${H - 3}" text-anchor="middle">${m}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kurva berat badan">
    <g class="grid">${grid}</g><g class="axis">${xl}</g>
    <polyline class="med" points="${medPts}"/>
    <polyline class="line" points="${pts.map(p => p.slice(0, 2).join(',')).join(' ')}"/>
    ${pts.map(([px, py], i) => `<circle class="pt ${i === pts.length - 1 ? 'last' : ''}" cx="${px}" cy="${py}" r="${i === pts.length - 1 ? 5 : 3.5}"/>`).join('')}
  </svg>`;
}

function growthTab() {
  const list = [...store.s.growth].sort((a, b) => new Date(a.date) - new Date(b.date));
  const last = list.at(-1), prev = list.at(-2);
  const ms = store.s.milestones;
  return `${last ? `<div class="stats">
      <div class="stat"><span class="tone-pri">${ic('baby', 18)}</span><b>${last.weight}<small> kg</small></b><small>${prev ? `${last.weight - prev.weight >= 0 ? '+' : ''}${(last.weight - prev.weight).toFixed(1)} kg` : 'berat'}</small></div>
      <div class="stat"><span class="tone-info">${ic('ruler', 18)}</span><b>${last.height}<small> cm</small></b><small>panjang</small></div>
      <div class="stat"><span class="tone-ok">${ic('smile', 18)}</span><b>${last.head}<small> cm</small></b><small>lingkar kepala</small></div>
    </div>
    <div class="card"><div class="card-h"><b>Berat badan</b><small><i class="lg-line"></i>${esc(store.s.baby.name)} <i class="lg-med"></i>median WHO</small></div>${growthChart(list)}<small class="muted">Umur (bulan) · data terakhir ${fmtDay(new Date(last.date).getTime())}</small></div>` : empty('ruler', 'Belum ada data pengukuran')}
    <button class="btn btn-pri btn-lg" data-act="growthSheet">${ic('plus', 18)} Catat pengukuran</button>
    <div class="sec-h"><h3>Milestone</h3><small class="muted">usia ${babyAge(store.s.baby.birth)}</small></div>
    <div class="card list">${MILESTONES.map(([k, l, age]) => `<button class="row" data-act="toggleMilestone" data-k="${k}">
      <span class="check ${ms[k] ? 'on' : ''}">${ic('check', 14)}</span>
      <span class="row-main"><b>${l}</b><small>Umumnya ${age}</small></span></button>`).join('')}</div>`;
}
actions.toggleMilestone = el => {
  const k = el.dataset.k;
  store.s.milestones[k] = !store.s.milestones[k]; store.save();
  if (store.s.milestones[k]) toast('Milestone tercapai! 🎉', { icon: 'sparkles', tone: 'ok' });
  router.refresh();
};
actions.growthSheet = () => {
  const last = [...store.s.growth].sort((a, b) => new Date(a.date) - new Date(b.date)).at(-1) || { weight: 3.2, height: 50, head: 34 };
  sheet(`<h3 class="sheet-title">${ic('ruler', 20)} Catat pengukuran</h3>
    <form class="form" id="growth-form">
      <div class="grid2">
        <label class="field"><span>Berat (kg)</span><input name="weight" type="number" inputmode="decimal" step="0.01" min="1" max="30" value="${last.weight}" required></label>
        <label class="field"><span>Panjang (cm)</span><input name="height" type="number" inputmode="decimal" step="0.1" min="30" max="130" value="${last.height}" required></label>
      </div>
      <div class="grid2">
        <label class="field"><span>Lingkar kepala (cm)</span><input name="head" type="number" inputmode="decimal" step="0.1" min="25" max="60" value="${last.head}" required></label>
        <label class="field"><span>Tanggal</span><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" max="${new Date().toISOString().slice(0, 10)}" required></label>
      </div>
      <label class="field"><span>Catatan (opsional)</span><input name="note" maxlength="60" placeholder="cth. Imunisasi DPT 2, Posyandu"></label>
      <button class="btn btn-pri btn-lg" type="submit">${ic('check', 18)} Simpan</button>
    </form>`, {
    onMount: root => {
      $('#growth-form', root).onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target);
        store.s.growth.push({ id: 'g' + Date.now().toString(36), date: f.get('date'), weight: +f.get('weight'), height: +f.get('height'), head: +f.get('head'), note: String(f.get('note') || '').trim() });
        store.save(); closeSheet();
        toast('Pengukuran disimpan', { icon: 'ruler', tone: 'ok' });
        router.refresh();
      };
    },
  });
};

/* ---------------- Detail kejadian ---------------- */
route('event', {
  render({ id }) {
    const e = store.s.events.find(x => x.id === id);
    if (!e) return topbar('Kejadian') + empty('bell', 'Kejadian tidak ditemukan');
    const T = TYPES[e.type] || { label: e.type, icon: 'info' };
    const steps = [[e.ts, 'sparkles', 'Terdeteksi AI']];
    if (e.level !== 'info') steps.push([e.ts + 600, 'volume', 'Alarm berbunyi']);
    if (e.soothed) steps.push([e.ts + 900, 'music', 'Penenang otomatis diputar']);
    if (e.ack && e.level !== 'info') steps.push([e.ts + (e.ackSec || 0) * 1000, 'check', `Dicek ${esc(e.ackBy || '')}`]);
    const pend = !e.ack && e.level !== 'info';
    const m = e.metrics || {};
    return topbar(levelLabel(e.level)) + `<div class="stack">
      <div class="snap">${e.snap ? `<img src="${e.snap}" alt="Cuplikan kamera saat kejadian">` : `<div class="snap-ph">${ic('cctv', 36)}<small>Tidak ada cuplikan</small></div>`}</div>
      <div class="ev-title"><span class="row-ic lg tone-${levelTone(e.level)}">${ic(T.icon, 22)}</span><div><h2>${T.label}</h2><small>${fmtDay(e.ts)} · ${fmtTime(e.ts)}</small></div></div>
      <p class="muted">${DESC[e.type] || ''}</p>
      ${e.metrics ? `<div class="chips">
        <span class="chip">${ic('volume', 13)} suara ${m.level ?? '–'}</span>
        <span class="chip">${ic('move', 13)} gerak ${m.motion ?? '–'}%</span>
        ${m.rpm ? `<span class="chip">${ic('wind', 13)} ${m.rpm}/mnt</span>` : ''}</div>` : ''}
      <div class="card steps">${steps.map(([ts, i, l]) => `<div class="step"><span>${ic(i, 14)}</span><b>${l}</b><small>${fmtTimeS(ts)}</small></div>`).join('')}
        ${pend ? `<div class="step pend"><span>${ic('clock', 14)}</span><b>Menunggu konfirmasi</b></div>` : ''}</div>
      ${pend ? `<button class="btn btn-pri btn-lg" data-act="ackAll">${ic('check', 20)} Sudah saya cek</button>` : ''}
      <div class="btn-row">
        ${e.level !== 'info' ? `<button class="btn btn-soft" data-act="toggleFalse" data-id="${e.id}">${ic('flag', 16)} ${e.falseAlarm ? 'Bukan alarm palsu' : 'Alarm palsu'}</button>` : ''}
        <button class="btn btn-soft danger" data-act="delEvent" data-id="${e.id}">${ic('trash', 16)} Hapus</button>
      </div>
    </div>`;
  },
});
actions.toggleFalse = el => {
  const e = store.s.events.find(x => x.id === el.dataset.id);
  if (!e) return;
  e.falseAlarm = !e.falseAlarm; e.ack = true; store.save();
  toast(e.falseAlarm ? 'Ditandai alarm palsu' : 'Tanda alarm palsu dihapus', { icon: 'flag' });
  router.refresh();
};
actions.delEvent = async el => {
  if (!await confirmBox('Hapus kejadian?', 'Catatan & cuplikan dihapus permanen.', 'Hapus', true)) return;
  store.s.events = store.s.events.filter(x => x.id !== el.dataset.id);
  store.save(); bus.emit('events'); router.back();
};

/* ---------------- Ekspor ---------------- */
actions.exportCsv = () => {
  const rows = [['Waktu', 'Kategori', 'Jenis', 'Detail', 'Oleh', 'Respons (detik)', 'Alarm palsu']];
  store.s.events.forEach(e => rows.push([new Date(e.ts).toISOString(), 'Kejadian', TYPES[e.type]?.label || e.type, levelLabel(e.level), e.ackBy || '', e.ackSec ?? '', e.falseAlarm ? 'Ya' : '']));
  store.s.care.forEach(c => rows.push([new Date(c.ts).toISOString(), 'Perawatan', CARE[c.type]?.label || c.type, c.detail, c.by || '', '', '']));
  store.s.sleep.filter(x => x.end).forEach(x => rows.push([new Date(x.start).toISOString(), 'Tidur', 'Sesi tidur', fmtDur(x.end - x.start), '', '', '']));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `jurnal-${store.s.baby.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
  toast('File CSV diunduh', { icon: 'download', tone: 'ok' });
};

actions.printReport = () => {
  const s = store.s, b = s.baby;
  const g = [...s.growth].sort((a, c) => new Date(a.date) - new Date(c.date));
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const avg7 = sleptBetween(day0.getTime() - 7 * DAY, day0.getTime()) / 7;
  const w = window.open('', '_blank');
  if (!w) { toast('Izinkan pop-up untuk membuat laporan', { icon: 'alert', tone: 'warn' }); return; }
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan ${esc(b.name)}</title>
  <style>body{font:14px/1.5 system-ui,sans-serif;color:#1c1a2e;max-width:780px;margin:32px auto;padding:0 20px}h1{margin:0;font-size:24px}h2{font-size:15px;margin:26px 0 8px;padding-bottom:4px;border-bottom:2px solid #eee}
  .meta{color:#706c85;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.box{border:1px solid #e6e2da;border-radius:10px;padding:10px 12px}.box b{display:block;font-size:18px}
  table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}th{color:#706c85;font-weight:600}
  button{float:right;padding:8px 14px;border:0;border-radius:8px;background:#6a5ae0;color:#fff;font-weight:700;cursor:pointer}@media print{button{display:none}}</style></head><body>
  <button onclick="print()">Cetak / simpan PDF</button>
  <h1>Laporan Pemantauan Bayi</h1><div class="meta">${esc(b.name)} · ${babyAge(b.birth)} · dibuat ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</div>
  <div class="grid"><div class="box">Rata-rata tidur<b>${fmtDur(avg7)}/hari</b>7 hari terakhir</div>
  <div class="box">Berat terakhir<b>${g.at(-1)?.weight ?? '–'} kg</b>${g.at(-1)?.date ?? ''}</div>
  <div class="box">Peringatan<b>${s.events.filter(e => e.level !== 'info' && e.ts > Date.now() - 7 * DAY).length}</b>7 hari terakhir</div></div>
  ${b.note ? `<h2>Catatan kesehatan</h2><p>${esc(b.note)}</p>` : ''}
  <h2>Tumbuh kembang</h2><table><tr><th>Tanggal</th><th>Berat (kg)</th><th>Panjang (cm)</th><th>Lingkar kepala (cm)</th><th>Catatan</th></tr>
  ${g.map(x => `<tr><td>${x.date}</td><td>${x.weight}</td><td>${x.height}</td><td>${x.head}</td><td>${esc(x.note || '')}</td></tr>`).join('')}</table>
  <h2>Perawatan terbaru</h2><table><tr><th>Waktu</th><th>Jenis</th><th>Detail</th></tr>
  ${s.care.slice(0, 15).map(c => `<tr><td>${fmtDay(c.ts)} ${fmtTime(c.ts)}</td><td>${CARE[c.type]?.label || c.type}</td><td>${esc(c.detail)}</td></tr>`).join('')}</table>
  <h2>Peringatan AI</h2><table><tr><th>Waktu</th><th>Kejadian</th><th>Level</th><th>Respons</th></tr>
  ${s.events.filter(e => e.level !== 'info').slice(0, 15).map(e => `<tr><td>${fmtDay(e.ts)} ${fmtTime(e.ts)}</td><td>${TYPES[e.type]?.label || e.type}</td><td>${levelLabel(e.level)}${e.falseAlarm ? ' (palsu)' : ''}</td><td>${e.ackSec != null ? e.ackSec + ' dtk' : '–'}</td></tr>`).join('')}</table>
  <p style="margin-top:24px;font-size:11px;color:#706c85">Data dari aplikasi AI Baby Monitor sebagai pendukung konsultasi. Bukan diagnosis medis.</p></body></html>`);
  w.document.close();
};
