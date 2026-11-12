/* LINK — sambungan langsung (WebRTC, peer-to-peer) antara KAMERA BAYI dan MONITOR ORANG TUA.
   • Server PeerJS publik hanya dipakai untuk "berkenalan" (signaling). Video & suara mengalir langsung antar-HP.
   • Kamera bayi punya kode 6 huruf + kunci rahasia. Orang tua yang tidak tahu kuncinya ditolak.
   • Satu kamera bayi bisa dipantau beberapa HP orang tua sekaligus (Ayah, Bunda, Nenek).

   Pesan (data channel):
     orang tua → bayi : hello{secret,name} · ping{ts} · cmd{a:'lull'|'lullStop'|'say'|'vol', ...}
     bayi → orang tua : welcome{baby} · deny · pong{ts} · r{level,cry,motion,dark,bat,charging} · lull{on,track,endAt} */
import { loadScript } from '../core/util.js';
import { bus } from '../core/bus.js';
import { silentTrack } from './audio.js';

const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const PEER_CFG = {
  debug: 1,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] },
};
const idOf = code => 'aibm3-' + String(code).toLowerCase();

let peer = null, conn = null, call = null, args = null;
let retryTimer = null, pingTimer = null, watchTimer = null, retryDelay = 3000;
let lastMsg = 0, micStream = null, silent = null;
const parentAudio = new Map();

export const link = {
  role: null,              // 'parent' | 'baby'
  state: 'idle',           // parent: idle|connecting|connected|lost|notfound|denied|error · baby: idle|starting|ready|taken|error
  error: '',
  everConnected: false,
  lastReading: null,
  latency: null,
  remoteStream: null,
  baby: null,              // info bayi dari kamera (nama, foto)
  babyLull: null,
  parents: new Map(),      // (peran bayi) orang tua yang tersambung

  /* ================= MONITOR ORANG TUA ================= */
  async join({ code, secret, name }, { resume = false } = {}) {
    this.leave({ resume });
    this.role = 'parent';
    args = { code, secret, name };
    setState('connecting');
    try { await loadScript(PEERJS); }
    catch { setState('error', 'Tidak bisa memuat modul koneksi. Periksa internet.'); return retry(); }
    if (args?.code !== code) return;
    peer = new window.Peer(PEER_CFG);
    peer.on('open', () => connectToBaby());
    peer.on('call', c => {
      silent ||= silentTrack();
      c.answer(new MediaStream(silent ? [silent] : []));
      call = c;
      c.on('stream', s => { this.remoteStream = s; bus.emit('link:stream', s); });
      c.on('close', () => { if (call === c) { call = null; this.remoteStream = null; bus.emit('link:stream', null); } });
    });
    peer.on('disconnected', () => { if (!peer?.destroyed) peer.reconnect(); });
    peer.on('error', err => {
      if (err.type === 'peer-unavailable') setState(this.everConnected ? 'lost' : 'notfound');
      else setState(this.everConnected ? 'lost' : 'error', err.message || String(err.type));
      retry();
    });
    clearInterval(pingTimer); clearInterval(watchTimer);
    pingTimer = setInterval(() => send({ t: 'ping', ts: Date.now() }), 4000);
    watchTimer = setInterval(() => {
      if (this.state === 'connected' && Date.now() - lastMsg > 8000) drop();
    }, 2000);
  },

  leave({ resume = false } = {}) {
    clearTimeout(retryTimer); clearInterval(pingTimer); clearInterval(watchTimer);
    args = null;
    stopMic();
    try { conn?.close(); } catch { /* */ }
    try { call?.close(); } catch { /* */ }
    try { peer?.destroy(); } catch { /* */ }
    peer = conn = call = null;
    this.remoteStream = null; this.lastReading = null; this.latency = null;
    if (this.role === 'parent') { if (!resume) this.everConnected = false; bus.emit('link:stream', null); }
    this.parents.forEach((_, id) => dropParent(id));
    this.role = null;
    setState('idle');
  },

  /** Kirim perintah ke kamera bayi (lagu, bicara, volume). */
  cmd(a, data = {}) { return send({ t: 'cmd', a, ...data }); },

  /** Tahan untuk bicara: ganti jalur audio senyap dengan mikrofon. */
  async talk(on) {
    const sender = call?.peerConnection?.getTransceivers().find(t => t.receiver.track?.kind === 'audio')?.sender;
    if (!sender) return false;
    try {
      if (on) {
        micStream ||= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        await sender.replaceTrack(micStream.getAudioTracks()[0]);
      } else {
        await sender.replaceTrack(silent);
        stopMic();
      }
      return true;
    } catch { stopMic(); return false; }
  },

  /* ================= KAMERA BAYI ================= */
  async host({ code, secret, stream, info }) {
    this.leave();
    this.role = 'baby';
    args = { code, secret, stream, info };
    setState('starting');
    try { await loadScript(PEERJS); }
    catch { setState('error', 'Tidak bisa memuat modul koneksi. Periksa internet.'); return retry(); }
    if (args?.code !== code) return;
    peer = new window.Peer(idOf(code), PEER_CFG);
    peer.on('open', () => { retryDelay = 3000; setState('ready'); });
    peer.on('disconnected', () => { if (!peer?.destroyed) peer.reconnect(); });
    peer.on('error', err => {
      setState(err.type === 'unavailable-id' ? 'taken' : 'error', err.message || String(err.type));
      if (['unavailable-id', 'network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) retry();
    });
    peer.on('connection', c => {
      c.on('data', m => onBabyData(c, m));
      c.on('close', () => dropParent(c.peer));
      c.on('error', () => dropParent(c.peer));
    });
  },

  /** Kirim ke semua orang tua yang tersambung. */
  broadcast(msg) {
    this.parents.forEach(p => { if (p.conn.open) try { p.conn.send(msg); } catch { /* */ } });
  },

  /** Kamera dibalik → ganti track video/audio di semua sambungan tanpa putus. */
  updateStream(stream) {
    if (args) args.stream = stream;
    this.parents.forEach(p => {
      p.call?.peerConnection?.getSenders().forEach(s => {
        const t = stream.getTracks().find(x => x.kind === s.track?.kind);
        if (t) s.replaceTrack(t).catch(() => {});
      });
    });
  },
  updateInfo(info) { if (args) args.info = info; this.broadcast({ t: 'welcome', baby: info }); },
};

function setState(s, err = '') {
  link.state = s; link.error = err;
  bus.emit('link:state', s);
}

function send(msg) {
  if (!conn?.open) return false;
  try { conn.send(msg); return true; } catch { return false; }
}

function retry() {
  clearTimeout(retryTimer);
  const a = args, role = link.role;
  if (!a) return;
  retryTimer = setTimeout(() => {
    if (args !== a) return;
    if (role === 'parent') link.join(a, { resume: true });
    else link.host(a);
  }, retryDelay);
  retryDelay = Math.min(15000, retryDelay * 1.5);
}

function connectToBaby() {
  conn = peer.connect(idOf(args.code), { reliable: true });
  conn.on('open', () => send({ t: 'hello', secret: args.secret, name: args.name, v: 3 }));
  conn.on('data', onParentData);
  conn.on('close', () => drop());
  conn.on('error', () => drop());
}

function onParentData(m) {
  lastMsg = Date.now();
  switch (m?.t) {
    case 'welcome':
      link.baby = m.baby || null;
      link.everConnected = true;
      retryDelay = 3000;
      setState('connected');
      bus.emit('link:baby', link.baby);
      break;
    case 'deny':
      setState('denied', 'Kunci pairing salah');
      clearTimeout(retryTimer); args = null;
      try { peer?.destroy(); } catch { /* */ }
      break;
    case 'r': link.lastReading = { ...m, ts: Date.now() }; break;
    case 'pong': link.latency = Math.round((Date.now() - m.ts) / 2); break;
    case 'lull': link.babyLull = m; bus.emit('link:lull', m); break;
  }
}

function drop() {
  if (link.role !== 'parent' || !args) return;
  try { conn?.close(); } catch { /* */ }
  try { call?.close(); } catch { /* */ }
  try { peer?.destroy(); } catch { /* */ }
  peer = conn = call = null;
  link.remoteStream = null; link.lastReading = null;
  bus.emit('link:stream', null);
  setState(link.everConnected ? 'lost' : 'connecting');
  retry();
}

function stopMic() {
  micStream?.getTracks().forEach(t => t.stop());
  micStream = null;
}

/* ---------- sisi kamera bayi ---------- */
function onBabyData(c, m) {
  const id = c.peer;
  if (m?.t === 'hello') {
    if (m.secret !== args?.secret) {
      try { c.send({ t: 'deny' }); } catch { /* */ }
      setTimeout(() => c.close(), 500);
      return;
    }
    dropParent(id, true);
    const p = { conn: c, name: String(m.name || 'Orang tua').slice(0, 24), since: Date.now(), call: null };
    link.parents.set(id, p);
    c.send({ t: 'welcome', baby: args.info });
    p.call = peer.call(id, args.stream);
    p.call.on('stream', s => {
      // suara orang tua (tombol bicara) diputar di speaker kamera bayi
      let a = parentAudio.get(id);
      if (!a) { a = Object.assign(new Audio(), { autoplay: true }); parentAudio.set(id, a); }
      a.srcObject = s; a.play().catch(() => {});
    });
    bus.emit('link:parents', link.parents);
    return;
  }
  if (!link.parents.has(id)) return;                 // belum terverifikasi
  if (m.t === 'ping') { try { c.send({ t: 'pong', ts: m.ts }); } catch { /* */ } }
  else if (m.t === 'cmd') bus.emit('link:cmd', { ...m, from: link.parents.get(id).name });
}

function dropParent(id, silentDrop = false) {
  const p = link.parents.get(id);
  if (!p) return;
  try { p.call?.close(); } catch { /* */ }
  try { p.conn.close(); } catch { /* */ }
  const a = parentAudio.get(id);
  if (a) { a.srcObject = null; parentAudio.delete(id); }
  link.parents.delete(id);
  if (!silentDrop) bus.emit('link:parents', link.parents);
}
