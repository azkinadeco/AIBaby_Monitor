/* Audio: alarm (sirene/lonceng/suara), suara Bahasa Indonesia (TTS), lagu & suara penenang,
   dan suara kamar simulasi untuk mode demo. Semua dibuat dengan Web Audio — tanpa file audio. */
import { sleep } from '../core/util.js';
import { bus } from '../core/bus.js';

let ac = null, master = null;
function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
/* Browser hanya mengizinkan suara setelah ada sentuhan pengguna */
bus.on('gesture', () => { ctx(); try { speechSynthesis.getVoices(); } catch { /* */ } });

function note(freq, start, dur, { type = 'sine', vol = .25, attack = .01, release = .25, dest = master } = {}) {
  const c = ctx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur + release);
  o.connect(g).connect(dest);
  o.start(start); o.stop(start + dur + release + .05);
}

function siren(vol) {
  const c = ctx(); if (!c) return 0;
  const t = c.currentTime, v = .18 * vol;
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 2400;
  o.frequency.setValueAtTime(650, t);
  for (let i = 0; i < 4; i++) {
    o.frequency.linearRampToValueAtTime(1250, t + i * .5 + .25);
    o.frequency.linearRampToValueAtTime(650, t + i * .5 + .5);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + .05);
  g.gain.setValueAtTime(v, t + 1.9);
  g.gain.linearRampToValueAtTime(0, t + 2);
  o.connect(f).connect(g).connect(master);
  o.start(t); o.stop(t + 2.05);
  return 2000;
}
function chime(vol) {
  const c = ctx(); if (!c) return 0;
  const t = c.currentTime;
  [880, 1108.7, 1318.5, 1760].forEach((f, i) => note(f, t + i * .28, .2, { vol: .22 * vol, release: .9 }));
  return 1900;
}

/* ---------------- Suara (TTS) ---------------- */
let voices = [];
const idVoice = () => {
  try { if (!voices.length) voices = speechSynthesis.getVoices(); } catch { return null; }
  return voices.find(v => /^id/i.test(v.lang)) || null;
};
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voices = speechSynthesis.getVoices(); };

export function speak(text, vol = 1) {
  if (!('speechSynthesis' in window)) return sleep(1200);
  return new Promise(res => {
    let done = false;
    const fin = () => { if (!done) { done = true; res(); } };
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'id-ID'; u.volume = Math.max(.1, vol);
      const v = idVoice(); if (v) u.voice = v;
      u.onend = fin; u.onerror = fin;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { fin(); }
    setTimeout(fin, 9000);
  });
}

/* ---------------- Alarm berulang (sampai dikonfirmasi) ---------------- */
let alarmToken = 0, alarmOn = false;
export async function startAlarm({ style = 'siren', volume = 85, text = '', voice = true } = {}) {
  stopAlarm();
  alarmOn = true;
  const my = ++alarmToken, vol = Math.max(.05, volume / 100);
  const live = () => alarmOn && my === alarmToken;
  while (live()) {
    const d = style === 'siren' ? siren(vol) : style === 'chime' ? chime(vol) : 0;
    if (d) await sleep(d + 150);
    if (!live()) break;
    if (voice || style === 'voice') await speak(text, vol);
    if (!live()) break;
    await sleep(1200);
  }
}
export function stopAlarm() {
  alarmOn = false; alarmToken++;
  try { speechSynthesis.cancel(); } catch { /* */ }
}

export async function testAlarm({ style, volume, babyName }) {
  const vol = volume / 100;
  if (style === 'siren') { siren(vol); await sleep(2100); }
  else if (style === 'chime') { chime(vol); await sleep(1900); }
  await speak(`Tes alarm. Ini suara peringatan untuk ${babyName}.`, vol);
}

/* ---------------- Lagu & suara penenang ---------------- */
const NF = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880 };
export const TRACKS = {
  noise: { name: 'White noise', icon: 'wind', noise: 'pink' },
  womb: { name: 'Detak jantung ibu', icon: 'heart', noise: 'womb' },
  rain: { name: 'Hujan lembut', icon: 'droplet', noise: 'rain' },
  nina: { name: 'Nina Bobo', icon: 'music', beat: .48, notes: 'E4 F4 G4- A4 G4 F4 E4 D4- G4 A4 B4- C5 B4 A4 G4- E4 F4 G4- A4 G4 F4 E4 D4- G4 B4 D5 C5 B4 A4 G4 C5- _ _' },
  brahms: { name: 'Brahms Lullaby', icon: 'music', beat: .45, notes: 'E4 E4 G4- E4 E4 G4- E4 G4 C5 B4- A4 A4 G4- D4 E4 F4- D4 D4 E4 F4- D4 F4 B4 A4 G4 B4 C5- _ _' },
  twinkle: { name: 'Twinkle Twinkle', icon: 'sparkles', beat: .5, notes: 'C5 C5 G5 G5 A5 A5 G5- F5 F5 E5 E5 D5 D5 C5- G5 G5 F5 F5 E5 E5 D5- G5 G5 F5 F5 E5 E5 D5- C5 C5 G5 G5 A5 A5 G5- F5 F5 E5 E5 D5 D5 C5- _ _' },
};

const lull = { on: false, track: null, vol: .7, gain: null, src: null, timer: null, tok: 0, endAt: 0, stopTimer: null };
const emitLull = () => bus.emit('lullaby', { on: lull.on, track: lull.track, endAt: lull.endAt });

export function lullStop() {
  const wasOn = lull.on;
  lull.on = false; lull.tok++; lull.endAt = 0;
  clearTimeout(lull.timer); clearTimeout(lull.stopTimer);
  const g = lull.gain, src = lull.src;
  lull.gain = null; lull.src = null;
  if (ac && g) {
    const t = ac.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + .4);
    setTimeout(() => { try { g.disconnect(); } catch { /* */ } }, 600);
    if (src) try { src.stop(t + .45); } catch { /* */ }
  }
  if (wasOn) emitLull();
}

/** Putar lagu/suara penenang. mins = 0 berarti terus menerus. */
export function lullPlay(track = 'noise', mins = 30) {
  lullStop();
  const c = ctx(); if (!c) return;
  const T = TRACKS[track] || TRACKS.noise;
  lull.on = true; lull.track = track;
  lull.endAt = mins ? Date.now() + mins * 60000 : 0;
  if (mins) lull.stopTimer = setTimeout(lullStop, mins * 60000);
  const my = lull.tok;
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(lull.vol, c.currentTime + 1.2);   // masuk perlahan agar bayi tidak kaget
  g.connect(master); lull.gain = g;

  if (T.noise) {
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048;
      const pat = T.noise === 'rain' ? .7 + .3 * Math.sin(i / (c.sampleRate * .45)) : .9;
      d[i] = (b0 + b1 + b2 + w * .05) * pat;
    }
    // sambungan loop dibuat halus
    for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] *= k; d[len - 1 - i] *= k; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = T.noise === 'womb' ? 420 : T.noise === 'rain' ? 1350 : 1800;
    const ng = c.createGain(); ng.gain.value = T.noise === 'womb' ? .5 : .35;
    src.connect(lp).connect(ng).connect(g); src.start(); lull.src = src;
    if (T.noise === 'womb') {
      const beat = () => {
        if (!lull.on || my !== lull.tok) return;
        const t = c.currentTime + .02;
        note(62, t, .09, { vol: .3, attack: .02, release: .12, dest: g });
        note(54, t + .22, .11, { vol: .22, attack: .02, release: .16, dest: g });
        lull.timer = setTimeout(beat, 920);
      };
      beat();
    }
  } else {
    const notes = T.notes.split(' ');
    let i = 0;
    const step = () => {
      if (!lull.on || my !== lull.tok) return;
      const n = notes[i++ % notes.length], long = n.endsWith('-'), key = n.replace('-', '');
      const dur = T.beat * (long ? 2 : 1);
      if (NF[key]) {
        const t = c.currentTime + .02;
        note(NF[key], t, dur * .8, { type: 'triangle', vol: .14, release: .5, dest: g });
        note(NF[key] / 2, t, dur * .8, { vol: .06, release: .5, dest: g });
      }
      lull.timer = setTimeout(step, dur * 1000);
    };
    step();
  }
  emitLull();
}
export function lullVolume(v) {
  if (v === undefined) return lull.vol;
  lull.vol = v;
  if (lull.gain && ac) lull.gain.gain.setTargetAtTime(v, ac.currentTime, .05);
  return v;
}
export const lullState = () => ({ on: lull.on, track: lull.track, endAt: lull.endAt });

/* ---------------- Suara kamar (simulasi untuk mode demo) ---------------- */
let roomSrc = null, cryTimer = null;
export function demoRoomAudio(on) {
  if (!on && !roomSrc) return;
  const c = ctx(); if (!c) return;
  if (on && !roomSrc) {
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    roomSrc = c.createBufferSource(); roomSrc.buffer = buf; roomSrc.loop = true;
    const g = c.createGain(); g.gain.value = .25;
    roomSrc.connect(g).connect(master); roomSrc.start();
  } else if (!on && roomSrc) {
    try { roomSrc.stop(); } catch { /* */ }
    roomSrc = null; demoCrying(false);
  }
}
function wail() {
  const c = ctx(); if (!c || !roomSrc) return;
  const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.2;
  lfo.frequency.value = 7; lg.gain.value = 18; lfo.connect(lg).connect(o.frequency);
  o.frequency.setValueAtTime(380, t);
  o.frequency.linearRampToValueAtTime(520, t + .25);
  o.frequency.linearRampToValueAtTime(470, t + .7);
  o.frequency.linearRampToValueAtTime(330, t + 1);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .08);
  g.gain.setValueAtTime(.09, t + .8); g.gain.linearRampToValueAtTime(0, t + 1.05);
  o.connect(bp).connect(g).connect(master);
  o.start(t); lfo.start(t); o.stop(t + 1.1); lfo.stop(t + 1.1);
}
export function demoCrying(on) {
  if (on && roomSrc && !cryTimer) { wail(); cryTimer = setInterval(wail, 1500); }
  if (!on && cryTimer) { clearInterval(cryTimer); cryTimer = null; }
}

/** Nada senyap untuk "slot" audio WebRTC (diganti mikrofon saat tombol bicara ditahan). */
export function silentTrack() {
  const c = ctx(); if (!c) return null;
  const dst = c.createMediaStreamDestination();
  const o = c.createOscillator(), g = c.createGain();
  g.gain.value = 0; o.connect(g).connect(dst); o.start();
  return dst.stream.getAudioTracks()[0];
}
export const audioContext = () => ctx();
/** false = browser masih menahan audio (belum ada sentuhan sejak dibuka) */
export const audioReady = () => ac?.state === 'running';
