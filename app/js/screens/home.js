/* BERANDA — satu layar: kamera + status & indikator, 3 tombol cepat, daftar "Hari ini". */
import { $, $$, esc, fmtDur, fmtTime, babyAge, HOUR } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { babyAvatar } from '../core/ui.js';
import { live, sleptBetween } from '../services/monitor.js';
import { mountFeed } from '../services/feed.js';
import { control } from '../services/control.js';
import { wakeWindow, nextFeed } from '../services/insights.js';
import { statusNow, vitalChips, timeline24, lastCare, linkLabel, sinceText } from './shared.js';

const WAVE = 16;
/** "baru" untuk < 1 menit, selain itu durasi singkat (1j 18m) */
const ago = ts => (Date.now() - ts < 60000 ? 'baru' : fmtDur(Date.now() - ts));

/* ---------- Status melayang di atas video ---------- */
function statusPill() {
  const S = statusNow();
  const bad = ['offline', 'waiting', 'paused'].includes(S.key);
  const sub = bad ? (S.key === 'paused' ? 'AI dijeda' : linkLabel().text) : fmtDur(Date.now() - sinceText().from);
  let hint = '';
  if (S.key === 'awake' || S.key === 'active') {
    const w = wakeWindow();
    if (w.from) hint = `<span class="hc-hint">${ic('moon', 12)} ${Date.now() < w.from ? fmtTime(w.from) : 'waktunya tidur'}</span>`;
  }
  return `<span class="hc-status tone-${S.tone}"><span class="hc-ic">${ic(S.icon, 18)}</span><b>${S.text}</b><small data-b="since">${sub}</small></span>${hint}`;
}

/* ---------- Tombol cepat ---------- */
function dock() {
  const l = control.lullState();
  const b = (attr, icon, label, on = false) => `<button class="dk ${on ? 'on' : ''}" ${attr}>${on ? '<span class="eq"><i></i><i></i><i></i></span>' : ic(icon, 20)}<b>${label}</b></button>`;
  return b('data-act="lullaby"', 'music', l.on ? 'Diputar' : 'Lagu', l.on)
    + b('data-act="talk"', 'mic', 'Bicara')
    + b('data-go="night"', 'moonStar', 'Tidur');
}

/* ---------- Daftar "Hari ini" ---------- */
function today() {
  const m = lastCare('milk'), d = lastCare('diaper'), f = nextFeed(), unread = store.unread();
  const care = (t, c, icon, tone, label, sub) => `<div class="hr">
      <button class="hr-main" data-act="care" data-t="${t}"><span class="hr-ic tone-${tone}">${ic(icon, 20)}</span>
        <span class="hr-t"><b>${label}</b><small>${sub}</small></span><span class="hr-v">${c ? ago(c.ts) : '–'}${c && Date.now() - c.ts >= 60000 ? '<small>lalu</small>' : ''}</span></button>
      <button class="hr-plus tone-${tone}" data-act="quickCare" data-t="${t}" aria-label="Catat ${label}">${ic('plus', 18)}</button></div>`;
  const feedSub = !m ? 'Belum dicatat' : f?.due ? '<em class="tone-warn">Waktunya menyusu</em>' : f ? `Berikutnya ${fmtTime(f.at)}` : 'Terakhir';
  return care('milk', m, 'bottle', 'pri', 'Susu', feedSub)
    + care('diaper', d, 'diaper', 'info', 'Popok', d ? 'Terakhir ganti' : 'Belum dicatat')
    + `<button class="hr hr-main" data-go="journal?tab=sleep"><span class="hr-ic tone-ok">${ic('moon', 20)}</span>
        <span class="hr-t"><b>Tidur</b>${timeline24({ labels: false, events: false })}</span><span class="hr-v">${fmtDur(sleptBetween(Date.now() - 24 * HOUR))}</span>${ic('chevR', 16)}</button>`
    + `<button class="hr hr-main ${unread ? 'alert' : ''}" data-go="journal"><span class="hr-ic tone-${unread ? 'bad' : 'ok'}">${ic(unread ? 'bell' : 'shield', 20)}</span>
        <span class="hr-t"><b>Peringatan</b><small>${unread ? 'Belum dicek' : 'Tidak ada yang baru'}</small></span><span class="hr-v">${unread || ''}</span>${ic('chevR', 16)}</button>`;
}

route('home', {
  tab: 'home',
  render() {
    const s = store.s, L = linkLabel();
    return `
    <header class="top">
      <button class="who" data-go="baby">${babyAvatar(44)}<span><b>${esc(s.baby.name)}</b><small>${babyAge(s.baby.birth)}</small></span></button>
      <div class="top-act">
        ${s.mode === 'demo' ? `<button class="tag-btn" data-act="demoPanel" aria-label="Panel simulasi">${ic('flask', 14)} Demo</button>`
          : `<button class="link-dot tone-${L.tone}" data-go="devices" aria-label="${L.text}">${ic(L.icon, 16)}</button>`}
      </div>
    </header>
    <div class="stack">
      ${s.mode === 'parent' && !s.pair.code ? `<button class="banner" data-go="connect">${ic('link', 18)}<span><b>Hubungkan kamera</b></span>${ic('chevR', 18)}</button>` : ''}
      <button class="hero-cam" data-go="live" aria-label="Buka tampilan langsung" id="home-cam">
        <span class="live-tag"><i></i>LIVE</span>
        ${live.temp != null ? `<span class="cam-chip">${ic('thermo', 12)}<b data-b="temp">${live.temp}</b>°</span>` : ''}
        <div class="hc-bottom"><div class="hc-left"><div id="home-status" class="hc-st">${statusPill()}</div><div class="hc-chips" id="home-vit">${vitalChips()}</div></div>
          <span class="wave" id="home-wave" aria-hidden="true">${'<i></i>'.repeat(WAVE)}</span></div>
      </button>
      <section class="dock" id="home-dock">${dock()}</section>
      <section class="today">
        <div class="sec-h"><h3>Hari ini</h3><button class="chip-btn" data-act="care">${ic('plus', 14)} Catat</button></div>
        <div class="hlist" id="home-bento">${today()}</div>
      </section>
    </div>`;
  },
  mount(root) {
    const feedOff = mountFeed($('#home-cam', root));
    const set = (id, html) => { const el = $(id, root); if (el) el.innerHTML = html; };
    const bars = $$('#home-wave i', root);
    const wave = () => {
      const h = live.hist.level.slice(-WAVE);
      bars.forEach((b, i) => { const v = h[i - (WAVE - h.length)] ?? 0; b.style.transform = `scaleY(${Math.max(.08, v / 100).toFixed(2)})`; });
    };
    wave();
    const offs = [
      bus.on('tick', () => {
        set('#home-vit', vitalChips()); wave();
        const since = $('[data-b=since]', root);
        if (since && !['offline', 'waiting', 'paused'].includes(statusNow().key)) since.textContent = fmtDur(Date.now() - sinceText().from);
        const t = $('[data-b=temp]', root); if (t && live.temp != null) t.textContent = live.temp;
      }),
      bus.on('status', () => set('#home-status', statusPill())),
      bus.on('source', () => router.refresh()),
      bus.on('armed', () => set('#home-status', statusPill())),
      bus.on('link:state', () => set('#home-status', statusPill())),
      bus.on('lullaby', () => set('#home-dock', dock())),
      ...['care', 'sleep', 'events'].map(ev => bus.on(ev, () => set('#home-bento', today()))),
    ];
    const t = setInterval(() => { set('#home-bento', today()); set('#home-status', statusPill()); }, 30000);
    return () => { feedOff(); offs.forEach(f => f()); clearInterval(t); };
  },
});
