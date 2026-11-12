/* ALARM — yang terjadi saat Monitor memicu kejadian:
   layar peringatan penuh, sirene + suara Bahasa Indonesia, getar, notifikasi sistem, dan penenang otomatis. */
import { $, esc, fmtTime, inRange, vibrate } from '../core/util.js';
import { ic } from '../core/icons.js';
import { bus } from '../core/bus.js';
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { actions, toast } from '../core/ui.js';
import * as audio from './audio.js';
import { TYPES, resetCooldowns } from './monitor.js';
import { mountFeed } from './feed.js';
import { control } from './control.js';
import { sim } from './sim.js';

export const DESC = {
  cry: 'Tangisan terdeteksi beberapa detik berturut-turut.',
  motion: 'Gerakan berlebih di luar pola tidur biasanya.',
  wake: 'Mata terbuka dan mulai aktif.',
  position: 'Wajah bayi tidak terlihat kamera. Segera telentangkan.',
  vomit: 'Terdeteksi pola menyerupai muntahan. Periksa jalan napas.',
  breath: 'Gerakan dada tidak teratur. Ini bukan diagnosis medis — segera periksa.',
  link: 'Monitor tidak menerima gambar dari kamera bayi. Cek baterai & Wi-Fi HP kamera.',
  battery: 'Baterai HP kamera bayi di bawah 15%. Colokkan pengisi daya.',
};

const RANK = { info: 0, warning: 1, critical: 2 };
let current = null, feedCleanup = null, muted = false;
const baseTitle = document.title;

export const alarm = {
  get current() { return current; },
  get muted() { return muted; },
};

export const quietNow = () => { const q = store.s.settings.alarm.quiet; return q.on && inRange(q.from, q.to); };

function handle(ev) {
  const T = TYPES[ev.type], S = store.s.settings.alarm, name = store.s.baby.name;
  if (S.vibrate) vibrate(ev.level === 'critical' ? [400, 150, 400, 150, 400] : [250, 100, 250]);
  notify(ev);

  if (ev.level === 'info') {
    toast(`${T.label} · ${fmtTime(ev.ts)}`, { icon: T.icon, tone: 'info', ms: 3500 });
    if (S.voice && !quietNow()) audio.speak(T.speak(name), S.volume / 100);
    return;
  }
  // jangan timpa alarm darurat dengan peringatan yang lebih ringan
  if (current && RANK[current.level] > RANK[ev.level]) {
    toast(`Juga terdeteksi: ${T.label}`, { icon: 'alert', tone: 'warn' });
    return;
  }
  // penenang otomatis saat bayi menangis/gelisah
  if (['cry', 'motion'].includes(ev.type) && S.autoSoothe && !control.lullState().on && control.canReach) {
    control.lullPlay(S.sootheTrack, S.sootheMins);
    ev.soothed = S.sootheTrack;
    store.save();
  }
  current = ev; muted = false;
  show(ev);
  const silent = ev.level === 'warning' && quietNow();
  if (!silent) sound(ev);
  document.title = `● ${T.label} — ${baseTitle}`;
}

function sound(ev) {
  const S = store.s.settings.alarm, T = TYPES[ev.type];
  audio.startAlarm({
    style: S.sound,
    volume: Math.max(S.volume, ev.level === 'critical' ? 95 : 0),
    text: T.speak(store.s.baby.name),
    voice: S.voice,
  });
}

function show(ev) {
  const T = TYPES[ev.type];
  close(true);
  const quiet = ev.level === 'warning' && quietNow();
  const el = document.createElement('div');
  el.id = 'alarm';
  el.className = `alarm lv-${ev.level}`;
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `
    <div class="alarm-body">
      <div class="alarm-kicker">${ic('clock', 14)} ${fmtTime(ev.ts)}${quiet ? ` · ${ic('moon', 14)} jam tenang, tanpa bunyi` : ''}</div>
      <div class="alarm-ic">${ic(T.icon, 34)}</div>
      <h2>${T.label}</h2>
      <p>${DESC[ev.type]}${ev.soothed ? ` <b>Penenang otomatis diputar.</b>` : ''}</p>
      ${ev.type === 'battery' ? '' : `<div class="alarm-feed">${ev.type === 'link' ? `<div class="alarm-nofeed">${ic('wifiOff', 34)}</div>` : '<span class="live-tag"><i></i>LIVE</span>'}</div>`}
      <button class="btn btn-white btn-lg" data-act="alarmAck">${ic('check', 20)} Saya cek sekarang</button>
      <div class="alarm-row">
        ${ev.type !== 'link' && ev.type !== 'battery' ? `<button data-act="alarmLive">${ic('video', 20)}<span>Lihat</span></button>` : ''}
        <button data-act="alarmMute" id="alarm-mute">${ic('volumeX', 20)}<span>Bisukan</span></button>
        ${ev.type !== 'link' && ev.type !== 'battery' ? `<button data-act="alarmFalse">${ic('flag', 20)}<span>Alarm palsu</span></button>` : ''}
      </div>
    </div>`;
  $('#overlay-root').appendChild(el);
  const box = el.querySelector('.alarm-feed');
  if (box && ev.type !== 'link') feedCleanup = mountFeed(box);
  requestAnimationFrame(() => el.classList.add('in'));
}

function close(instant = false) {
  feedCleanup?.(); feedCleanup = null;
  const el = $('#alarm');
  if (!el) return;
  el.classList.remove('in');
  if (instant) el.remove(); else setTimeout(() => el.remove(), 260);
}

function stop() {
  audio.stopAlarm();
  current = null; muted = false;
  close();
  $('#alarm-pill')?.remove();
  document.title = baseTitle;
}

function ack(falseAlarm = false, by = store.s.parentName) {
  const now = Date.now();
  store.s.events.forEach(e => {
    if (!e.ack && e.level !== 'info') { e.ack = true; e.ackBy = by; e.ackSec = Math.round((now - e.ts) / 1000); }
  });
  if (falseAlarm && current) {
    const e = store.s.events.find(x => x.id === current.id);
    if (e) e.falseAlarm = true;
  }
  store.save(); bus.emit('events');
  const was = current;
  stop();
  resetCooldowns();
  if (falseAlarm) toast('Ditandai alarm palsu — terima kasih atas masukannya', { icon: 'flag' });
  else toast('Dikonfirmasi. Alarm dimatikan', { icon: 'checkCircle', tone: 'ok' });
  // mode demo: anggap orang tua sudah menenangkan bayi
  if (store.s.mode === 'demo' && was && sim.state !== 'sleep') {
    const st = sim.state;
    setTimeout(() => { if (sim.state === st) sim.set(['cry', 'move'].includes(st) ? 'awake' : 'sleep'); }, 1500);
    setTimeout(() => { if (sim.state === 'awake') sim.set('sleep'); }, 12000);
  }
}

function minimize() {
  muted = true; audio.stopAlarm();
  $('#alarm')?.classList.add('minimized');
  $('#alarm-pill')?.remove();
  if (!current) return;
  const p = document.createElement('button');
  p.id = 'alarm-pill';
  p.className = `alarm-pill lv-${current.level}`;
  p.innerHTML = `${ic('alert', 16)}<span>${esc(TYPES[current.type].label)} — ketuk untuk konfirmasi</span>`;
  p.onclick = () => { $('#alarm')?.classList.remove('minimized'); p.remove(); };
  $('#overlay-root').appendChild(p);
}

/** Notifikasi sistem — hanya saat aplikasi di latar belakang (di depan sudah ada layar alarm/toast). */
export async function systemNotify(title, body, { tag = 'aibm', critical = false } = {}) {
  if (!store.s.settings.alarm.notify || !('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  const opts = { body, tag, renotify: true, icon: 'assets/icon-192.png', badge: 'assets/favicon-32.png', requireInteraction: critical, vibrate: [300, 100, 300] };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* tidak didukung */ }
}
const notify = ev => systemNotify(`${TYPES[ev.type].label} · ${store.s.baby.name}`, DESC[ev.type], { tag: ev.type, critical: ev.level === 'critical' });

bus.on('alert', handle);
bus.on('link:restored', () => {
  if (current?.type === 'link') { ack(false, 'Sistem'); toast('Kamera bayi tersambung kembali', { icon: 'wifi', tone: 'ok' }); }
});

actions.alarmAck = () => ack(false);
actions.alarmFalse = () => ack(true);
actions.alarmLive = () => { minimize(); router.go('live'); };
actions.alarmMute = () => {
  muted = !muted;
  if (muted) audio.stopAlarm(); else if (current) sound(current);
  const b = $('#alarm-mute');
  if (b) b.innerHTML = muted ? `${ic('volume', 20)}<span>Bunyikan</span>` : `${ic('volumeX', 20)}<span>Bisukan</span>`;
};
actions.ackAll = () => {
  if (current) return ack(false);
  store.s.events.forEach(e => { if (!e.ack) { e.ack = true; e.ackBy = store.s.parentName; } });
  store.save(); bus.emit('events');
  toast('Semua dikonfirmasi', { tone: 'ok' });
};
