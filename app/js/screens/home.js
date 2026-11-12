/* BERANDA — sekali lihat langsung tahu: bayi sedang apa, sejak kapan, dan apakah semua aman. */
import { $, esc, fmtAgo, fmtDur, babyAge, HOUR } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { babyAvatar } from '../core/ui.js';
import { live, sleptBetween } from '../services/monitor.js';
import { mountFeed } from '../services/feed.js';
import { control } from '../services/control.js';
import { TRACKS } from '../services/audio.js';
import { statusNow, soundWord, moveWord, eventRow, timeline24, lastCare, linkLabel, sinceText } from './shared.js';

function hero() {
  const S = statusNow(), L = linkLabel();
  const breath = live.rpm ? (60 / live.rpm) * 2 : 5;
  const sub = ['offline', 'waiting', 'paused'].includes(S.key)
    ? (S.key === 'paused' ? 'Alarm otomatis tidak aktif' : store.s.mode === 'parent' ? 'Pastikan HP kamera bayi menyala & tersambung internet' : 'Kamera tidak mengirim gambar')
    : sinceText().text;
  return `<div class="orb tone-${S.tone}" style="--breath:${breath.toFixed(1)}s"><i></i><i></i><i></i><span class="orb-core">${ic(S.icon, 34)}</span></div>
    <h1 class="hero-status">${S.text}</h1>
    <p class="hero-sub" data-b="since">${sub}</p>
    ${store.s.mode === 'demo' ? '' : `<button class="pill tone-${L.tone}" data-go="devices">${ic(L.icon, 14)} ${L.text}</button>`}`;
}

function conditions() {
  const third = live.rpm != null
    ? { icon: 'wind', label: 'Napas', val: `${Math.round(live.rpm)}<small>/mnt</small>`, tone: live.rpm >= 60 || live.rpm <= 18 ? 'bad' : 'ok', pct: live.rpm / 80 }
    : live.bat != null
      ? { icon: live.bat < .2 ? 'batteryLow' : 'battery', label: 'Baterai kamera', val: `${Math.round(live.bat * 100)}<small>%</small>`, tone: live.bat < .2 && !live.charging ? 'bad' : 'ok', pct: live.bat }
      : { icon: 'activity', label: 'Respons', val: live.latency != null ? `${live.latency}<small>ms</small>` : '–', tone: 'ok', pct: .2 };
  const cryTone = live.cry >= .35 || live.level >= 62 ? 'warn' : 'ok';
  const movTone = live.motion >= 50 ? 'warn' : 'ok';
  const tile = (icon, label, val, tone, pct) => `<div class="cond tone-${tone}">
    <span class="cond-ic">${ic(icon, 16)}</span><small>${label}</small><b>${val}</b>
    <span class="meter"><i style="width:${Math.round(Math.min(1, Math.max(.03, pct)) * 100)}%"></i></span></div>`;
  return tile('volume', 'Suara', soundWord(live.level, live.cry), cryTone, live.level / 100)
    + tile('move', 'Gerakan', moveWord(live.motion), movTone, live.motion / 100)
    + tile(third.icon, third.label, third.val, third.tone, third.pct);
}

function quickActions() {
  const l = control.lullState();
  const btn = (act, icon, label, on = false, extra = '') => `<button class="qa ${on ? 'on' : ''}" ${act.startsWith('go:') ? `data-go="${act.slice(3)}"` : `data-act="${act}"`} ${extra}><span>${ic(icon, 22)}${on ? '<i class="qa-eq"></i>' : ''}</span><small>${label}</small></button>`;
  return btn('lullaby', 'music', l.on ? (TRACKS[l.track]?.name.split(' ')[0] || 'Diputar') : 'Penenang', l.on)
    + btn('talk', 'mic', 'Bicara')
    + btn('go:night', 'moonStar', 'Mode tidur')
    + btn('care', 'plus', 'Catat');
}

function careCard() {
  const m = lastCare('milk'), d = lastCare('diaper');
  const item = (c, t, icon, label) => `<div class="care-item">
    <span class="care-ic tone-${t === 'milk' ? 'pri' : 'info'}">${ic(icon, 18)}</span>
    <span class="care-t"><small>${label}</small><b>${c ? fmtAgo(c.ts) : 'Belum dicatat'}</b>${c ? `<small>${esc(c.detail)}</small>` : ''}</span>
    <button class="icon-btn soft sm" data-act="quickCare" data-t="${t}" aria-label="Catat ${label}">${ic('plus', 18)}</button>
  </div>`;
  return item(m, 'milk', 'bottle', 'Susu terakhir') + item(d, 'diaper', 'diaper', 'Popok terakhir');
}

function sleepCard() {
  const total = sleptBetween(Date.now() - 24 * HOUR);
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  return `<div class="card-h"><b>${ic('moon', 16)} Tidur 24 jam terakhir</b><span class="big-num">${fmtDur(total)}</span></div>
    ${timeline24()}
    <div class="legend"><span><i class="lg-sleep"></i>Tidur</span><span><i class="lg-warn"></i>Peringatan</span><span>Hari ini: <b>${fmtDur(sleptBetween(day0.getTime()))}</b></span></div>`;
}

function recentEvents() {
  const list = store.s.events.filter(e => e.level !== 'info').slice(0, 3);
  return list.length ? list.map(eventRow).join('') : `<p class="muted small pad-s">Belum ada peringatan. Semua tenang.</p>`;
}

route('home', {
  tab: 'home',
  render() {
    const s = store.s, unread = store.unread();
    const banner = s.mode === 'demo'
      ? `<button class="banner" data-go="welcome">${ic('flask', 18)}<span><b>Mode demo · bayi simulasi</b><small>Siap pakai sungguhan? Sambungkan 2 HP</small></span>${ic('chevR', 18)}</button>`
      : s.mode === 'parent' && !s.pair.code ? `<button class="banner" data-go="connect">${ic('link', 18)}<span><b>Hubungkan kamera bayi</b><small>Masukkan kode dari HP kamera</small></span></button>` : '';
    return `
    <header class="top">
      <button class="who" data-go="baby">${babyAvatar(46)}<span><b>${esc(s.baby.name)}</b><small>${babyAge(s.baby.birth)}</small></span></button>
      <div class="top-act">
        ${s.mode === 'demo' ? `<button class="icon-btn soft only-narrow" data-act="demoPanel" aria-label="Panel simulasi">${ic('flask', 20)}</button>` : ''}
        <button class="icon-btn soft" data-go="journal" aria-label="Kejadian">${ic('bell', 20)}${unread ? `<i class="dot-badge">${unread > 9 ? '9+' : unread}</i>` : ''}</button>
      </div>
    </header>
    <div class="stack">
      ${banner}
      <section class="hero" id="home-hero">${hero()}</section>
      <button class="cam-card" data-go="live" aria-label="Buka tampilan langsung" id="home-cam">
        <span class="live-tag"><i></i>LIVE</span>
        ${live.temp != null ? `<span class="cam-chip">${ic('thermo', 12)} <b data-b="temp">${live.temp}</b>°C · <b data-b="hum">${live.hum}</b>%</span>` : ''}
        <span class="cam-go">${ic('maximize', 16)}</span>
      </button>
      <section class="conds" id="home-cond">${conditions()}</section>
      <section class="qas" id="home-qa">${quickActions()}</section>
      <section class="card care-card" id="home-care">${careCard()}</section>
      <section class="card" id="home-sleep" data-go="journal?tab=sleep" role="button">${sleepCard()}</section>
      <div class="sec-h"><h3>Peringatan terbaru</h3><a data-go="journal">Semua</a></div>
      <section class="card list" id="home-ev">${recentEvents()}</section>
    </div>`;
  },
  mount(root) {
    const feedOff = mountFeed($('#home-cam', root));
    const set = (id, html) => { const el = $(id, root); if (el) el.innerHTML = html; };
    const offs = [
      bus.on('tick', () => {
        set('#home-cond', conditions());
        const since = $('[data-b=since]', root);
        if (since && !['offline', 'waiting', 'paused'].includes(statusNow().key)) since.textContent = sinceText().text;
        if (live.temp != null) { const t = $('[data-b=temp]', root), h = $('[data-b=hum]', root); if (t) t.textContent = live.temp; if (h) h.textContent = live.hum; }
      }),
      bus.on('status', () => set('#home-hero', hero())),
      bus.on('source', () => router.refresh()),
      bus.on('armed', () => set('#home-hero', hero())),
      bus.on('link:state', () => set('#home-hero', hero())),
      bus.on('lullaby', () => set('#home-qa', quickActions())),
      bus.on('care', () => set('#home-care', careCard())),
      bus.on('sleep', () => set('#home-sleep', sleepCard())),
      bus.on('events', () => { set('#home-ev', recentEvents()); set('#home-sleep', sleepCard()); }),
    ];
    // napas berubah perlahan → perbarui kecepatan animasi orb sesekali
    const t = setInterval(() => { const o = $('.orb', root); if (o && live.rpm) o.style.setProperty('--breath', `${((60 / live.rpm) * 2).toFixed(1)}s`); }, 8000);
    return () => { feedOff(); offs.forEach(f => f()); clearInterval(t); };
  },
});
