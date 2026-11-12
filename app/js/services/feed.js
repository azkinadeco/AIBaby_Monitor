/* Menampilkan gambar kamera dari sumber aktif ke dalam sebuah kotak.
   Demo → <canvas> simulasi · Kamera HP ini → <video> lokal · Kamera bayi → <video> dari WebRTC.
   Otomatis berganti saat sumber/stream berubah; kembalikan fungsi cleanup. */
import { bus } from '../core/bus.js';
import { simCam } from './sim.js';
import { live, localCam } from './monitor.js';
import { link } from './link.js';

export function mountFeed(box) {
  let detach = null;
  const build = () => {
    detach?.(); detach = null;
    box.querySelector('.feed')?.remove();
    let el;
    if (live.source === 'sim') {
      el = document.createElement('canvas');
      detach = simCam.attach(el);
    } else {
      el = Object.assign(document.createElement('video'), { muted: true, autoplay: true, playsInline: true });
      el.setAttribute('playsinline', '');
      const stream = live.source === 'local' ? localCam.stream : link.remoteStream;
      if (stream) { el.srcObject = stream; el.play().catch(() => {}); }
      el.classList.toggle('mirror', live.source === 'local' && localCam.facing === 'user');
    }
    el.className += ' feed';
    box.prepend(el);
    box.classList.toggle('no-signal', live.source !== 'sim' && !el.srcObject);
  };
  build();
  const offs = [bus.on('source', build), bus.on('link:stream', build), bus.on('localcam', build)];
  return () => { detach?.(); offs.forEach(f => f()); };
}
