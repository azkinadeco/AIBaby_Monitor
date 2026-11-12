/* MODE TIDUR ORANG TUA — layar hampir hitam, tetap menyala, alarm tetap aktif.
   Taruh HP di samping bantal; bangun hanya kalau si kecil butuh. */
import { $, fmtTime, WakeLock, esc } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { toast } from '../core/ui.js';
import { live } from '../services/monitor.js';
import { setListen } from '../services/control.js';
import { statusNow, sinceText, linkLabel } from './shared.js';

function line() {
  const S = statusNow();
  const sub = ['offline', 'waiting', 'paused'].includes(S.key) ? linkLabel().text : sinceText().text;
  return `<span class="tone-${S.tone}">${ic(S.icon, 18)}</span><b>${esc(store.s.baby.name)} · ${S.text}</b><small>${sub}</small>`;
}

route('night', {
  dark: true,
  render() {
    return `<div class="night" id="night">
      <button class="night-x" data-act="back" aria-label="Keluar mode tidur">${ic('x', 22)}</button>
      <div class="night-clock" id="n-clock">${fmtTime(Date.now())}</div>
      <div class="night-line" id="n-line">${line()}</div>
      <div class="night-level"><i id="n-level"></i></div>
      <div class="night-foot">
        <button class="pill ${store.s.listen ? 'on' : ''}" id="n-listen">${ic(store.s.listen ? 'volume' : 'volumeX', 14)} ${store.s.listen ? 'Mendengarkan' : 'Dengarkan kamar'}</button>
        <small>${WakeLock.supported ? 'Layar tetap menyala' : 'Jangan kunci layar'}</small>
      </div>
    </div>`;
  },
  mount(root) {
    WakeLock.hold('night');
    document.body.classList.add('night-on');
    const n = $('#night', root);
    let fade = setTimeout(() => n.classList.add('deep'), 8000);
    const wake = () => { n.classList.remove('deep'); clearTimeout(fade); fade = setTimeout(() => n.classList.add('deep'), 8000); };
    n.addEventListener('pointerdown', wake);
    n.addEventListener('dblclick', () => router.back());
    $('#n-listen', root).onclick = e => {
      e.stopPropagation();
      setListen(!store.s.listen);
      router.refresh();
    };
    const offs = [
      bus.on('tick', () => {
        $('#n-clock', root).textContent = fmtTime(Date.now());
        $('#n-line', root).innerHTML = line();
        $('#n-level', root).style.transform = `scaleX(${Math.max(.02, live.level / 100)})`;
      }),
    ];
    if (!WakeLock.supported) toast('Atur kunci layar otomatis HP ke "Tidak pernah" agar alarm tetap terdengar', { icon: 'info', ms: 5000 });
    return () => { WakeLock.release('night'); document.body.classList.remove('night-on'); clearTimeout(fade); offs.forEach(f => f()); };
  },
});
