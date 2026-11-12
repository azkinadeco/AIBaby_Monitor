/* Komponen yang dipakai beberapa layar. */
import { $, $$, esc, fmtTime, fmtDay, fmtDur, HOUR, clamp } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { actions, sheet, closeSheet, toast } from '../core/ui.js';
import { TYPES, STATUS, live } from '../services/monitor.js';
import { TRACKS } from '../services/audio.js';
import { control } from '../services/control.js';
import { link } from '../services/link.js';

export const levelTone = l => ({ critical: 'bad', warning: 'warn', info: 'info' }[l] || 'muted');
export const levelLabel = l => ({ critical: 'Darurat', warning: 'Peringatan', info: 'Info' }[l] || '');

export function statusNow() {
  const key = store.s.armed === false && !['offline', 'waiting'].includes(live.status) ? 'paused' : live.status;
  return { key, ...STATUS[key] };
}

/* Bahasa manusia untuk angka sensor */
export const soundWord = (lv, cry) => cry >= .35 ? 'Menangis' : lv < 22 ? 'Hening' : lv < 42 ? 'Tenang' : lv < 62 ? 'Ramai' : 'Keras';
export const moveWord = m => m < 6 ? 'Diam' : m < 20 ? 'Sedikit' : m < 50 ? 'Aktif' : 'Sangat aktif';

/* ---------------- Kejadian ---------------- */
export function eventRow(e) {
  const T = TYPES[e.type] || { label: e.type, icon: 'info' };
  const st = e.level === 'info' ? '' : e.falseAlarm ? `<span class="badge muted">Palsu</span>` : e.ack ? `<span class="badge ok">${ic('check', 12)}</span>` : '<span class="badge bad">Baru</span>';
  return `<button class="row" data-go="event/${e.id}">
    <span class="row-ic tone-${levelTone(e.level)}">${ic(T.icon, 18)}</span>
    <span class="row-main"><b>${T.label}</b><small>${fmtTime(e.ts)}</small></span>
    ${st}
  </button>`;
}
export function groupByDay(list) {
  const out = []; let cur = null;
  list.forEach(e => { const d = fmtDay(e.ts); if (!cur || cur.d !== d) { cur = { d, items: [] }; out.push(cur); } cur.items.push(e); });
  return out;
}

/* ---------------- Timeline tidur 24 jam terakhir ---------------- */
export function timeline24({ events = true, labels: showLabels = true } = {}) {
  const now = Date.now(), from = now - 24 * HOUR, pct = t => clamp((t - from) / (24 * HOUR) * 100, 0, 100);
  const segs = store.s.sleep.filter(x => (x.end || now) > from).map(x => {
    const a = pct(x.start), b = pct(x.end || now);
    return `<i class="tl-sleep ${x.end ? '' : 'open'}" style="left:${a}%;width:${Math.max(.6, b - a)}%"></i>`;
  }).join('');
  const dots = events ? store.s.events.filter(e => e.ts > from && e.level !== 'info').map(e => `<em class="tl-dot ${levelTone(e.level)}" style="left:${pct(e.ts)}%"></em>`).join('') : '';
  // label di jam bulat (00, 06, 12, 18) yang jatuh di dalam rentang
  const first = new Date(from); first.setMinutes(0, 0, 0); first.setHours(Math.ceil(first.getHours() / 6) * 6);
  let labels = '';
  for (let t = first.getTime(); t < now - 2.5 * HOUR; t += 6 * HOUR) labels += `<small style="left:${pct(t)}%">${fmtTime(t).replace(':', '.')}</small>`;
  labels += '<small class="now" style="left:100%">Kini</small>';
  if (!showLabels) return `<div class="tl mini"><div class="tl-track">${segs}${dots}</div></div>`;
  return `<div class="tl"><div class="tl-track">${segs}${dots}</div><div class="tl-lbl">${labels}</div></div>`;
}

/* ---------------- Grafik garis mini (canvas) ---------------- */
export function drawSpark(cv, data, { color = '#8B7CF6', max = 100, min = 0, line = null, n = 90 } = {}) {
  const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  if (line != null) {
    const ty = h - 3 - ((line - min) / (max - min)) * (h - 6);
    x.setLineDash([3, 4]); x.strokeStyle = 'rgba(242,96,106,.55)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, ty); x.lineTo(w, ty); x.stroke(); x.setLineDash([]);
  }
  if (data.length < 2) return;
  const step = w / (n - 1), off = (n - data.length) * step;
  const pts = data.map((v, i) => [off + i * step, h - 3 - ((clamp(v, min, max) - min) / (max - min)) * (h - 6)]);
  x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.strokeStyle = color; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
  x.lineTo(pts.at(-1)[0], h); x.lineTo(pts[0][0], h); x.closePath();
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
  x.fillStyle = g; x.fill();
}
export const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------------- Lagu & penenang ---------------- */
let lullMins = 30;
export function openLullSheet() {
  const render = () => {
    const st = control.lullState();
    const reach = control.canReach;
    return `<h3 class="sheet-title">${ic('music', 20)} Penenang</h3>
      <p class="muted small">${store.s.mode === 'parent' ? 'Diputar di speaker HP kamera bayi.' : 'Diputar di perangkat ini (mode demo).'}</p>
      ${reach ? '' : `<div class="note warn">${ic('wifiOff', 16)} Kamera bayi belum tersambung.</div>`}
      <div class="tracks">${Object.entries(TRACKS).map(([k, t]) => `
        <button class="track ${st.on && st.track === k ? 'on' : ''}" data-act="lullPick" data-k="${k}" ${reach ? '' : 'disabled'}>
          <span class="track-ic">${ic(t.icon, 20)}</span><b>${t.name}</b>
          <span class="track-st">${st.on && st.track === k ? '<span class="eq"><i></i><i></i><i></i></span>' : ic('play', 14)}</span>
        </button>`).join('')}</div>
      <div class="field-h">${ic('clock', 14)} Berhenti otomatis</div>
      <div class="chips">${[[15, '15 mnt'], [30, '30 mnt'], [60, '1 jam'], [0, 'Terus']].map(([m, l]) => `<button class="chip ${lullMins === m ? 'on' : ''}" data-act="lullMins" data-m="${m}">${l}</button>`).join('')}</div>
      <div class="vol">${ic('volumeX', 18)}<input type="range" min="0.05" max="1" step="0.05" value="${control.lullVolume()}" id="lull-vol" aria-label="Volume penenang">${ic('volume', 18)}</div>
      ${st.on ? `<button class="btn btn-soft btn-lg" data-act="lullStop">${ic('stop', 18)} Hentikan${st.endAt ? ` · <span data-left>${leftStr(st.endAt)}</span>` : ''}</button>` : ''}`;
  };
  const el = sheet(render(), {
    onMount: root => {
      const bind = () => { const v = $('#lull-vol', root); if (v) v.oninput = () => control.lullVolume(+v.value); };
      bind();
      const re = () => { const s = $('.sheet', root); if (s) { s.innerHTML = '<div class="sheet-grip"></div>' + render(); bind(); } };
      const off = bus.on('lullaby', re);
      const t = setInterval(() => { const st = control.lullState(); $$('[data-left]', root).forEach(x => { x.textContent = leftStr(st.endAt); }); }, 1000);
      actions.lullMins = b => { lullMins = +b.dataset.m; const st = control.lullState(); if (st.on) control.lullPlay(st.track, lullMins); re(); };
      return () => { off(); clearInterval(t); };
    },
  });
  return el;
}
const leftStr = endAt => { const s = Math.max(0, Math.round((endAt - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
actions.lullPick = el => {
  const st = control.lullState();
  if (st.on && st.track === el.dataset.k) control.lullStop();
  else control.lullPlay(el.dataset.k, lullMins);
};
actions.lullStop = () => { control.lullStop(); toast('Penenang dihentikan', { icon: 'stop' }); };
actions.lullaby = () => openLullSheet();

/* ---------------- Bicara ke bayi ---------------- */
const PHRASES = ['Sssh… Bunda di sini', 'Tidur lagi ya, Nak', 'Ayah segera ke sana', 'Anak pintar, bobo ya'];
export function talkButtonHtml(big = false) {
  return `<div class="talk ${big ? 'big' : ''}"><button class="talk-btn" data-talk aria-label="Tahan untuk bicara">${ic('mic', big ? 30 : 24)}</button><span class="talk-lbl">Tahan</span></div>`;
}
/** Tombol tahan-untuk-bicara (pointer down/up). */
export function bindTalk(root) {
  const btns = $$('[data-talk]', root);
  const offs = btns.map(b => {
    const lbl = b.parentElement.querySelector('.talk-lbl');
    let on = false, t0 = 0;
    const start = async e => {
      e.preventDefault();
      if (!control.canReach) { toast('Kamera bayi belum tersambung', { icon: 'wifiOff', tone: 'warn' }); return; }
      on = true; t0 = Date.now(); b.classList.add('on');
      if (lbl) lbl.textContent = 'Bicara…';
      const ok = await control.talk(true);
      if (!ok && on) { toast('Mikrofon tidak bisa dipakai', { icon: 'micOff', tone: 'warn' }); end(); }
    };
    const end = () => {
      if (!on) return;
      on = false; b.classList.remove('on');
      if (lbl) lbl.textContent = 'Tahan';
      control.talk(false);
      const d = (Date.now() - t0) / 1000;
      if (d > .5 && store.s.mode === 'demo') toast(`Pesan suara ${d.toFixed(1)} dtk (simulasi)`, { icon: 'volume' });
    };
    b.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, end));
    b.addEventListener('contextmenu', e => e.preventDefault());
    return end;
  });
  return () => offs.forEach(f => f());
}
export function openTalkSheet() {
  sheet(`<h3 class="sheet-title">${ic('mic', 20)} Bicara ke ${esc(store.s.baby.name)}</h3>
    ${talkButtonHtml(true)}
    <div class="field-h">Atau putar kalimat</div>
    <div class="chips">${PHRASES.map(p => `<button class="chip" data-act="phrase">${p}</button>`).join('')}</div>`,
  { onMount: bindTalk });
}
actions.talk = () => openTalkSheet();
actions.phrase = el => {
  if (!control.canReach) { toast('Kamera bayi belum tersambung', { icon: 'wifiOff', tone: 'warn' }); return; }
  control.say(el.textContent);
  toast(`Diputar di kamar bayi: “${el.textContent}”`, { icon: 'volume' });
};

/* ---------------- Catatan perawatan ---------------- */
export const CARE = {
  milk: { label: 'Susu', icon: 'bottle', tone: 'pri', presets: ['60 ml', '90 ml', '120 ml', '150 ml', 'Menyusu langsung'] },
  diaper: { label: 'Popok', icon: 'diaper', tone: 'info', presets: ['Pipis', 'BAB', 'Pipis + BAB'] },
  sleepNote: { label: 'Tidur', icon: 'moon', tone: 'ok', presets: ['Tidur siang', 'Ditidurkan', 'Bangun'] },
  temp: { label: 'Suhu', icon: 'thermo', tone: 'warn', presets: ['36,5 °C', '36,8 °C', '37,5 °C', '38,0 °C'] },
  med: { label: 'Obat', icon: 'pill', tone: 'bad', presets: ['Vitamin D', 'Paracetamol', 'Zinc'] },
};
export function openCareSheet(type = 'milk') {
  const render = t => `<h3 class="sheet-title">${ic('plus', 20)} Catat perawatan</h3>
    <div class="care-types">${Object.entries(CARE).map(([k, v]) => `<button class="care-type ${k === t ? 'on' : ''} tone-${v.tone}" data-ct="${k}"><span>${ic(v.icon, 20)}</span><small>${v.label}</small></button>`).join('')}</div>
    <form class="form" id="care-form">
      <input type="hidden" name="type" value="${t}">
      <div class="chips">${CARE[t].presets.map(p => `<button type="button" class="chip" data-preset>${p}</button>`).join('')}</div>
      <label class="field"><span>Keterangan</span><input name="detail" id="care-detail" required maxlength="60" value="${CARE[t].presets[0]}"></label>
      <button class="btn btn-pri btn-lg" type="submit">${ic('check', 18)} Simpan</button>
    </form>`;
  sheet(render(type), {
    onMount: root => {
      const bind = () => {
        $$('[data-ct]', root).forEach(b => { b.onclick = () => { $('.sheet', root).innerHTML = '<div class="sheet-grip"></div>' + render(b.dataset.ct); bind(); }; });
        $$('[data-preset]', root).forEach(b => { b.onclick = () => { $('#care-detail', root).value = b.textContent; }; });
        $('#care-form', root).onsubmit = e => {
          e.preventDefault();
          const f = new FormData(e.target);
          store.addCare(f.get('type'), String(f.get('detail')).trim());
          closeSheet();
          toast(`${CARE[f.get('type')].label} dicatat`, { icon: 'check', tone: 'ok' });
        };
      };
      bind();
    },
  });
}
actions.care = el => openCareSheet(el?.dataset?.t || 'milk');
actions.quickCare = el => {
  const t = el.dataset.t;
  const item = store.addCare(t, CARE[t].presets[t === 'milk' ? 2 : 0]);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  toast(`${CARE[t].label} · ${fmtTime(item.ts)}`, { icon: CARE[t].icon, tone: 'ok', action: { label: 'Urungkan', fn: () => store.removeCare(item.id) } });
};
export const lastCare = type => store.s.care.find(c => c.type === type);

/* ---------------- Status sambungan (untuk mode orang tua) ---------------- */
export function linkLabel() {
  if (store.s.mode === 'demo') return { text: live.source === 'local' ? 'Kamera perangkat ini' : 'Mode demo', tone: 'info', icon: live.source === 'local' ? 'camera' : 'flask' };
  const m = {
    connected: { text: `Tersambung${link.latency != null ? ` · ${link.latency} ms` : ''}`, tone: 'ok', icon: 'wifi' },
    connecting: { text: 'Menyambungkan…', tone: 'muted', icon: 'link' },
    lost: { text: 'Terputus — mencoba lagi', tone: 'bad', icon: 'wifiOff' },
    notfound: { text: 'Kamera bayi tidak aktif', tone: 'warn', icon: 'wifiOff' },
    denied: { text: 'Kunci pairing salah', tone: 'bad', icon: 'lock' },
    error: { text: 'Gagal tersambung', tone: 'bad', icon: 'wifiOff' },
    idle: { text: 'Belum tersambung', tone: 'muted', icon: 'unlink' },
  };
  return m[link.state] || m.idle;
}

/** Durasi status saat ini, untuk teks "sejak 21:40 · 2j 15m" */
export function sinceText() {
  const open = store.s.sleep.find(x => !x.end);
  const from = live.status === 'sleep' && open ? open.start : live.since;
  return { from, text: `sejak ${fmtTime(from)} · ${fmtDur(Date.now() - from)}` };
}

