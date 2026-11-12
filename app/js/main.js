/* Titik masuk aplikasi. */
import { $ } from './core/util.js';
import { ic } from './core/icons.js';
import { store } from './core/store.js';
import { bus } from './core/bus.js';
import { router, setGuard } from './core/router.js';
import { applyTheme, toast } from './core/ui.js';
import { startMonitor } from './services/monitor.js';
import { link } from './services/link.js';
import { babyUnit } from './services/babyUnit.js';
import { applyListen } from './services/control.js';
import { sim, autoDemo } from './services/sim.js';
import './services/alarm.js';

import './screens/home.js';
import './screens/live.js';
import './screens/journal.js';
import './screens/babycam.js';
import './screens/night.js';
import { demoPanelHtml } from './screens/setup.js';
import { needsUnlock } from './screens/more.js';

/* ---------- Penjaga rute ---------- */
const OPEN = ['welcome', 'connect', 'babycam', 'help', 'lock'];
setGuard(({ name }) => {
  if (needsUnlock() && name !== 'lock') return 'lock';
  if (!store.s.onboarded && !OPEN.includes(name)) return 'welcome';
  if (store.s.mode === 'baby' && ['home', 'live', 'journal'].includes(name)) return 'babycam';
  return null;
});

/* ---------- Tab bar ---------- */
const TABS = [['home', 'home', 'Beranda'], ['live', 'video', 'Live'], ['journal', 'book', 'Jurnal'], ['more', 'grid', 'Lainnya']];
function renderTabs(active) {
  const tb = $('#tabbar');
  tb.classList.toggle('hidden', !active || store.s.mode === 'baby');
  if (!active) return;
  const unread = store.unread();
  tb.innerHTML = TABS.map(([id, icon, label]) => `<button class="tab ${id === active ? 'on' : ''}" data-go="${id}" data-replace aria-label="${label}">
    <span class="tab-ic">${ic(icon, 22)}${id === 'journal' && unread ? `<i class="dot-badge">${unread > 9 ? '9+' : unread}</i>` : ''}</span><small>${label}</small></button>`).join('');
}
let lastRoute = null;
bus.on('route', r => {
  lastRoute = r;
  renderTabs(r.tab);
  document.body.classList.toggle('route-dark', r.dark);
  applyTheme();
  renderSide();
});
bus.on('events', () => lastRoute && renderTabs(lastRoute.tab));

/* ---------- Panel simulasi menempel di samping (layar lebar) ---------- */
const wide = matchMedia('(min-width: 1000px)');
function renderSide() {
  const side = $('#side');
  const show = wide.matches && store.s.mode === 'demo';
  side.classList.toggle('hidden', !show);
  if (show) side.innerHTML = demoPanelHtml();
}
wide.addEventListener?.('change', renderSide);
bus.on('sim', () => { if (!$('#side').classList.contains('hidden')) renderSide(); });
bus.on('status', () => { if (!$('#side').classList.contains('hidden')) renderSide(); });
$('#side').addEventListener('change', e => {
  const el = e.target.closest('[data-demo]'); if (!el) return;
  if (el.dataset.demo === 'camOnline') sim.setCamera(el.checked);
  if (el.dataset.demo === 'hotRoom') sim.hotRoom = el.checked;
  if (el.dataset.demo === 'auto') autoDemo.set(el.checked);
});

/* ---------- Status internet ---------- */
function netBanner() {
  const b = $('#net-banner');
  b.classList.toggle('hidden', navigator.onLine);
  b.innerHTML = `${ic('wifiOff', 15)} Internet terputus${store.s.mode === 'parent' ? ' — video & alarm dari kamera bayi terhenti' : ''}`;
}
addEventListener('online', () => { netBanner(); toast('Internet tersambung kembali', { icon: 'wifi', tone: 'ok' }); });
addEventListener('offline', netBanner);

/* ---------- Tinggi layar nyata di HP (iOS Safari) ---------- */
const setH = () => document.documentElement.style.setProperty('--app-h', `${innerHeight}px`);
setH(); addEventListener('resize', setH);
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) document.documentElement.classList.add('standalone');

/* ---------- Mulai ---------- */
applyTheme();
startMonitor();
router.start();
netBanner();
applyListen();

// lanjutkan peran perangkat setelah aplikasi dibuka ulang
if (store.s.mode === 'parent' && store.s.pair.code) {
  link.join({ code: store.s.pair.code, secret: store.s.pair.secret, name: store.s.parentName });
}
if (store.s.mode === 'baby') {
  // izin kamera biasanya sudah diberikan → langsung jalan; kalau belum, layar kamera menampilkan tombol Mulai
  babyUnit.start().then(() => router.refresh()).catch(() => router.refresh());
  bus.on('gesture', () => import('./services/audio.js').then(a => a.audioContext()));
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* opsional */ });
}
