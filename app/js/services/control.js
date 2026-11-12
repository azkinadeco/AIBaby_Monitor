/* KONTROL KAMAR BAYI — satu pintu untuk lagu penenang, bicara, dan mendengarkan.
   Mode orang tua: perintah dikirim ke HP kamera bayi (bunyinya keluar di kamar bayi).
   Mode demo     : diputar di perangkat ini.                                        */
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import * as audio from './audio.js';
import { link } from './link.js';
import { sim } from './sim.js';
import { localCam, setRemoteVideo } from './monitor.js';

const remote = () => store.s.mode === 'parent';

export const control = {
  lullPlay(track, mins = 30) {
    if (remote()) return link.cmd('lull', { track, mins });
    audio.lullPlay(track, mins); return true;
  },
  lullStop() {
    if (remote()) return link.cmd('lullStop');
    audio.lullStop(); return true;
  },
  lullState() {
    if (remote()) { const l = link.babyLull; return l?.on ? l : { on: false }; }
    return audio.lullState();
  },
  lullVolume(v) {
    if (remote()) { if (v !== undefined) link.cmd('vol', { v }); return v ?? .7; }
    return audio.lullVolume(v);
  },
  /** Ucapkan kalimat di kamar bayi (suara Bahasa Indonesia). */
  say(text) {
    if (remote()) return link.cmd('say', { text });
    audio.speak(text, .8); return true;
  },
  /** Tahan-untuk-bicara. Demo: hanya simulasi. */
  async talk(on) {
    if (remote()) return link.talk(on);
    return true;
  },
  get canReach() { return !remote() || link.state === 'connected'; },
};
bus.on('link:lull', m => bus.emit('lullaby', m));

/* ---------- Dengarkan kamar bayi (seperti baby monitor klasik) ---------- */
const remoteAudio = Object.assign(new Audio(), { autoplay: true });
remoteAudio.muted = true;
// video tersembunyi untuk mengambil cuplikan saat alarm, walau layar Live tidak dibuka
const remoteVideo = Object.assign(document.createElement('video'), { muted: true, autoplay: true, playsInline: true });
remoteVideo.setAttribute('playsinline', '');
remoteVideo.className = 'offscreen';
document.body.appendChild(remoteVideo);
setRemoteVideo(remoteVideo);

bus.on('link:stream', s => {
  remoteAudio.srcObject = s; remoteVideo.srcObject = s;
  if (s) { remoteAudio.play().catch(() => {}); remoteVideo.play().catch(() => {}); }
  applyListen();
});

export function applyListen() {
  const on = !!store.s.listen;
  if (store.s.mode === 'parent') {
    remoteAudio.muted = !on;
    if (on) remoteAudio.play().catch(() => {});
  } else if (store.s.mode === 'demo' && !localCam.running) {
    audio.demoRoomAudio(on);
    audio.demoCrying(on && sim.state === 'cry');
  } else audio.demoRoomAudio(false);
}
export function setListen(on) {
  store.s.listen = on; store.save();
  applyListen();
  bus.emit('listen', on);
}
bus.on('sim', applyListen);
bus.on('gesture', () => { if (store.s.listen && remoteAudio.srcObject) remoteAudio.play().catch(() => {}); });
