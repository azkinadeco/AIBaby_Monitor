/* BERANDA — satu layar, sedikit tulisan: kamera + status, 3 indikator, tombol cepat, dan kotak ringkas. */
import { $, $$, esc, fmtDur, fmtTime, babyAge, HOUR } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { babyAvatar } from '../core/ui.js';
import { live, sleptBetween } from '../services/monitor.js';
import { mountFeed } from '../services/feed.js';
import { control } from '../services/control.js';
import { wakeWindow, nextFeed, nightReport } from '../services/insights.js';
import { statusNow, soundWord, moveWord, timeline24, lastCare, linkLabel, sinceText } from './shared.js';

const WAVE = 28;
/** "baru" untuk < 1 menit, selain itu durasi singkat (1j 18m) */
const ago = ts => (Date.now() - ts < 60000 ? 'baru' : fmtDur(Date.now() - ts));
const R = 21, RC = 2 * Math.PI * R;

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

/* ---------- 3 cincin indikator ---------- */
function ring(icon, word, pct, tone) {
  const p = Math.max(.04, Math.min(1, pct));
  return `<div class="vit tone-${tone}">
    <span class="vit-ring"><svg class="vr" viewBox="0 0 50 50"><circle cx="25" cy="25" r="${R}" class="vr-bg"/><circle cx="25" cy="25" r="${R}" class="vr-fg" stroke-dasharray="${(RC * p).toFixed(1)} ${RC.toFixed(1)}"/></svg>${ic(icon, 18)}</span>
    <b>${word}</b></div>`;
}
function vitals() {
  const third = live.rpm != null
    ? ring('wind', `${Math.round(live.rpm)}<small>/mnt</small>`, live.rpm / 80, live.rpm >= 60 || live.rpm <= 18 ? 'bad' : 'ok')
    : live.bat != null
      ? ring(live.bat < .2 ? 'batteryLow' : 'battery', `${Math.round(live.bat * 100)}%`, live.bat, live.bat < .2 && !live.charging ? 'bad' : 'ok')
      : ring('wifi', live.latency != null ? `${live.latency}<small>ms</small>` : '–', .3, 'ok');
  return ring('volume', soundWord(live.level, live.cry), live.level / 100, live.cry >= .35 || live.level >= 62 ? 'warn' : 'ok')
    + ring('move', moveWord(live.motion), live.motion / 100, live.motion >= 50 ? 'warn' : 'ok')
    + third;
}

/* ---------- Tombol cepat ---------- */
function dock() {
  const l = control.lullState();
  const b = (attr, icon, label, on = false) => `<button class="dk ${on ? 'on' : ''}" ${attr}><span>${ic(icon, 22)}${on ? '<span class="eq"><i></i><i></i><i></i></span>' : ''}</span><small>${label}</small></button>`;
  return b('data-act="lullaby"', 'music', l.on ? 'Diputar' : 'Lagu', l.on)
    + b('data-act="talk"', 'mic', 'Bicara')
    + b('data-go="night"', 'moonStar', 'Tidur')
    + b('data-act="care"', 'plus', 'Catat');
}

/* ---------- Kotak bento ---------- */
function bento() {
  const m = lastCare('milk'), d = lastCare('diaper'), f = nextFeed();
  const unread = store.unread(), r = nightReport();
  const care = (t, c, icon, label, sub) => `<button class="bt bt-care tone-${t === 'milk' ? 'pri' : 'info'}" data-act="quickCare" data-t="${t}" aria-label="Catat ${label}">
    <span class="bt-ic">${ic(icon, 20)}</span><span class="bt-plus">${ic('plus', 14)}</span>
    <b>${c ? ago(c.ts) : '–'}</b><small>${sub || label}</small></button>`;
  const feedSub = f ? (f.due ? '<em class="tone-warn">waktunya!</em>' : `→ ${fmtTime(f.at)}`) : 'Susu';
  return care('milk', m, 'bottle', 'Susu', m ? feedSub : 'Susu')
    + care('diaper', d, 'diaper', 'Popok', 'Popok')
    + `<button class="bt bt-wide" data-go="journal?tab=sleep">
        <span class="bt-row"><span class="bt-ic tone-ok">${ic('moon', 18)}</span><b>${fmtDur(sleptBetween(Date.now() - 24 * HOUR))}</b><small>24 jam</small></span>
        ${timeline24({ labels: false })}</button>`
    + `<button class="bt" data-go="report"><span class="bt-ic tone-accent">${ic('moonStar', 20)}</span><b>${r.hasData ? fmtDur(r.total) : '–'}</b><small>Semalam</small></button>`
    + `<button class="bt ${unread ? 'alert' : ''}" data-go="journal"><span class="bt-ic tone-${unread ? 'bad' : 'ok'}">${ic(unread ? 'bell' : 'shield', 20)}</span><b>${unread || 'Aman'}</b><small>${unread ? 'belum dicek' : 'Peringatan'}</small></button>`;
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
        <div class="hc-bottom"><div class="hc-left" id="home-status">${statusPill()}</div>
          <span class="wave" id="home-wave" aria-hidden="true">${'<i></i>'.repeat(WAVE)}</span></div>
      </button>
      <section class="vits" id="home-vit">${vitals()}</section>
      <section class="dock" id="home-dock">${dock()}</section>
      <section class="bento" id="home-bento">${bento()}</section>
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
        set('#home-vit', vitals()); wave();
        const since = $('[data-b=since]', root);
        if (since && !['offline', 'waiting', 'paused'].includes(statusNow().key)) since.textContent = fmtDur(Date.now() - sinceText().from);
        const t = $('[data-b=temp]', root); if (t && live.temp != null) t.textContent = live.temp;
      }),
      bus.on('status', () => set('#home-status', statusPill())),
      bus.on('source', () => router.refresh()),
      bus.on('armed', () => set('#home-status', statusPill())),
      bus.on('link:state', () => set('#home-status', statusPill())),
      bus.on('lullaby', () => set('#home-dock', dock())),
      ...['care', 'sleep', 'events'].map(ev => bus.on(ev, () => set('#home-bento', bento()))),
    ];
    const t = setInterval(() => { set('#home-bento', bento()); set('#home-status', statusPill()); }, 30000);
    return () => { feedOff(); offs.forEach(f => f()); clearInterval(t); };
  },
});
