/* LAPORAN SEMALAM & JENDELA TIDUR */
import { esc, fmtDur, fmtTime } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { actions, toast, topbar, empty } from '../core/ui.js';
import { nightReport, reportText } from '../services/insights.js';
import { CARE } from './shared.js';

/* ---------- Grafik aktivitas semalam (SVG) ---------- */
function activityChart(r) {
  const W = 330, H = 120, top = 8, base = 84, n = r.buckets.length, bw = W / n;
  const x = t => ((t - r.start) / (r.end - r.start)) * W;
  const bars = r.buckets.map((b, i) => {
    if (!b.k) return '';
    const h = Math.max(2, (b.lv / 100) * (base - top));
    return `<rect class="${b.cry ? 'cry' : b.lv > 45 ? 'loud' : ''}" x="${(i * bw + bw * .15).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw * .7).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
  }).join('');
  const sleep = r.sessions.map(([a, b]) => `<rect class="slp" x="${x(a).toFixed(1)}" y="92" width="${Math.max(1, x(b) - x(a)).toFixed(1)}" height="9" rx="4.5"/>`).join('');
  const feeds = r.feeds.map(f => `<circle class="feed" cx="${x(f.ts).toFixed(1)}" cy="110" r="3.5"/>`).join('');
  let ticks = '';
  const h0 = new Date(r.start); h0.setMinutes(0, 0, 0);
  for (let t = h0.getTime() + 2 * 3600000; t < r.end; t += 3 * 3600000) ticks += `<text x="${x(t).toFixed(1)}" y="${H - 1}" text-anchor="middle">${fmtTime(t).replace(':', '.')}</text>`;
  return `<svg class="act" viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="Aktivitas suara sepanjang malam">
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" class="ax"/>${bars}<rect class="slp-bg" x="0" y="92" width="${W}" height="9" rx="4.5"/>${sleep}${feeds}${ticks}</svg>`;
}

function verdict(r) {
  if (!r.hasData) return null;
  const h = r.total / 3600000;
  if (r.wakes <= 1 && h >= 8) return ['ok', 'sparkles', 'Malam yang nyenyak!'];
  if (r.wakes <= 3) return ['info', 'moon', 'Malam yang cukup tenang'];
  return ['warn', 'heart', 'Malam yang sibuk — semangat, Bunda & Ayah'];
}

route('report', {
  render() {
    const r = nightReport(), v = verdict(r);
    if (!r.hasData) return topbar(`Laporan ${r.label.toLowerCase()}`) + `<div class="stack">${empty('moon', 'Belum ada data tidur untuk malam ini. Laporan terisi otomatis saat kamera memantau.')}</div>`;
    const stat = (tone, icon, val, label) => `<div class="stat"><span class="tone-${tone}">${ic(icon, 18)}</span><b>${val}</b><small>${label}</small></div>`;
    return topbar(`Laporan ${r.label.toLowerCase()}`, { sub: `${fmtTime(r.start)} – ${r.live ? 'sekarang' : fmtTime(r.end)}`, right: `<button class="icon-btn" data-act="shareReport" aria-label="Bagikan">${ic('share', 20)}</button>` }) + `
    <div class="stack">
      ${v ? `<div class="verdict tone-${v[0]}">${ic(v[1], 22)}<div><b>${v[2]}</b><small>${esc(store.s.baby.name)} tidur ${fmtDur(r.total)}${r.bedtime ? `, mulai ${fmtTime(r.bedtime)}` : ''}${r.wakeUp ? `, bangun ${fmtTime(r.wakeUp)}` : ''}.</small></div></div>` : ''}
      <div class="stats">
        ${stat('ok', 'moon', fmtDur(r.total), 'total tidur')}
        ${stat('pri', 'bed', fmtDur(r.longest), 'terpanjang')}
        ${stat(r.wakes > 3 ? 'warn' : 'info', 'sunrise', `${r.wakes}×`, 'terbangun')}
      </div>
      <div class="card">
        <div class="card-h"><b>${ic('activity', 16)} Aktivitas suara</b><small>tiap 15 menit</small></div>
        ${activityChart(r)}
        <div class="legend"><span><i class="lg-sleep"></i>Tidur</span><span><i class="lg-warn"></i>Menangis</span><span><i class="lg-feed"></i>Menyusu</span></div>
      </div>
      <div class="card list">
        <div class="row"><span class="row-ic tone-pri">${ic(CARE.milk.icon, 18)}</span><span class="row-main"><b>Menyusu ${r.feeds.length}×</b><small>${r.feeds.map(f => fmtTime(f.ts)).reverse().join(' · ') || 'tidak tercatat'}</small></span></div>
        <div class="row"><span class="row-ic tone-info">${ic(CARE.diaper.icon, 18)}</span><span class="row-main"><b>Ganti popok ${r.diapers.length}×</b><small>${r.diapers.map(f => fmtTime(f.ts)).reverse().join(' · ') || 'tidak tercatat'}</small></span></div>
        <div class="row"><span class="row-ic tone-${r.alerts.length ? 'warn' : 'ok'}">${ic(r.alerts.length ? 'alert' : 'shield', 18)}</span><span class="row-main"><b>${r.alerts.length ? `${r.alerts.length} peringatan` : 'Tanpa peringatan'}</b><small>${r.alerts.length ? r.alerts.map(e => fmtTime(e.ts)).reverse().join(' · ') : 'Semua aman sepanjang malam'}</small></span>${r.alerts.length ? `<button class="btn btn-ghost btn-sm" data-go="journal">Lihat</button>` : ''}</div>
      </div>
      <button class="btn btn-pri btn-lg" data-act="shareReport">${ic('share', 18)} Bagikan ke pasangan</button>
    </div>`;
  },
  mount() {
    const offs = [bus.on('sleep', () => router.refresh()), bus.on('care', () => router.refresh())];
    return () => offs.forEach(f => f());
  },
});

actions.shareReport = async () => {
  const text = reportText(nightReport(), store.s.baby.name, fmtDur, fmtTime);
  try {
    if (navigator.share) { await navigator.share({ title: 'Laporan tidur', text }); return; }
    await navigator.clipboard.writeText(text);
    toast('Laporan disalin — tempel di WhatsApp', { icon: 'copy', tone: 'ok' });
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Tidak bisa membagikan dari browser ini', { icon: 'info' });
  }
};
