/* UNIT KAMERA BAYI — dijalankan di HP yang diletakkan di kamar bayi.
   Membuka kamera & mikrofon, menganalisis suara/gerakan, mengirim status ke HP orang tua tiap detik,
   dan menjalankan perintah dari orang tua (lagu penenang, kalimat suara). */
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { WakeLock, readableCode, digits } from '../core/util.js';
import { link } from './link.js';
import { localCam } from './monitor.js';
import * as audio from './audio.js';

let battery = null;
navigator.getBattery?.().then(b => { battery = b; }).catch(() => {});

export function pairInfo() {
  const p = store.s.own;
  if (!p.code || !p.secret) {
    p.code = readableCode(6); p.secret = digits(6);
    store.save();
  }
  return p;
}
export function pairUrl() {
  const p = pairInfo();
  return `${location.origin}${location.pathname}#/connect?c=${p.code}&k=${p.secret}`;
}
const babyInfo = () => ({ name: store.s.baby.name, birth: store.s.baby.birth, gender: store.s.baby.gender, photo: store.s.baby.photo });

export const babyUnit = {
  get running() { return localCam.running && link.role === 'baby'; },

  /** Harus dipanggil dari ketukan pengguna (izin kamera/mikrofon). */
  async start(facing = 'environment') {
    const p = pairInfo();
    store.s.mode = 'baby'; store.save();
    await localCam.start({ facing });
    bus.emit('localcam');
    WakeLock.hold('babycam');
    await link.host({ code: p.code, secret: p.secret, stream: localCam.stream, info: babyInfo() });
  },
  async flip() {
    await localCam.flip();
    link.updateStream(localCam.stream);
    bus.emit('localcam');
  },
  stop() {
    link.leave();
    localCam.stop();
    audio.lullStop();
    WakeLock.release('babycam');
    bus.emit('localcam');
  },
  /** Kode baru = semua HP orang tua lama harus memasangkan ulang. */
  async newCode() {
    store.s.own = { code: readableCode(6), secret: digits(6) };
    store.save();
    if (this.running) await link.host({ code: store.s.own.code, secret: store.s.own.secret, stream: localCam.stream, info: babyInfo() });
  },
};

/* Kirim bacaan ke orang tua tiap detik */
bus.on('tick', () => {
  if (link.role !== 'baby' || !link.parents.size) return;
  const r = localCam.read();
  if (!r.online) return;
  link.broadcast({
    t: 'r', level: Math.round(r.level * 10) / 10, cry: Math.round(r.cry * 100) / 100, motion: Math.round(r.motion * 10) / 10,
    dark: r.dark, bat: battery ? battery.level : null, charging: battery ? battery.charging : null,
  });
});

/* Perintah dari orang tua */
const lullMsg = () => ({ t: 'lull', ...audio.lullState() });
bus.on('link:cmd', m => {
  if (m.a === 'lull') audio.lullPlay(m.track, m.mins ?? 30);
  else if (m.a === 'lullStop') audio.lullStop();
  else if (m.a === 'vol') audio.lullVolume(Math.min(1, Math.max(.05, +m.v || .7)));
  else if (m.a === 'say' && m.text) audio.speak(String(m.text).slice(0, 120), .9);
  bus.emit('babycam:cmd', m);
});
bus.on('lullaby', () => { if (link.role === 'baby') link.broadcast(lullMsg()); });
bus.on('link:parents', () => { if (link.role === 'baby') link.broadcast(lullMsg()); });
bus.on('store', path => { if (link.role === 'baby' && path?.startsWith('baby')) link.updateInfo(babyInfo()); });
