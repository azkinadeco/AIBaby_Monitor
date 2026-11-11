/* Audio: alarm speaker (sirene / lonceng / suara), TTS Bahasa Indonesia, lagu tidur, audio kamar (simulasi) */
const Sound = (() => {
  let ac = null, master = null;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 1;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  const unlock = () => { ctx(); try { speechSynthesis.getVoices(); } catch (e) { /* */ } };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function note(freq, start, dur, { type = 'sine', vol = .25, attack = .01, release = .25, dest = null } = {}) {
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + release);
    o.connect(g).connect(dest || master);
    o.start(start); o.stop(start + dur + release + .05);
  }

  function siren(vol) {
    const c = ctx(); if (!c) return 0;
    const t = c.currentTime, v = .16 * vol;
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

  function beep(vol = .6) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    note(1046, t, .08, { vol: .2 * vol, release: .1 });
    note(1318, t + .12, .08, { vol: .2 * vol, release: .15 });
  }

  let voicesCache = [];
  function idVoice() {
    try {
      if (!voicesCache.length) voicesCache = speechSynthesis.getVoices();
      return voicesCache.find(v => /^id/i.test(v.lang)) || null;
    } catch (e) { return null; }
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voicesCache = speechSynthesis.getVoices(); };

  function speak(text, vol = 1) {
    if (!('speechSynthesis' in window)) return wait(1200);
    return new Promise(res => {
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'id-ID'; u.rate = 1; u.pitch = 1; u.volume = Math.max(.1, vol);
        const v = idVoice(); if (v) u.voice = v;
        u.onend = fin; u.onerror = fin;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (e) { fin(); }
      setTimeout(fin, 9000);
    });
  }

  /* ---------- Alarm berulang (sampai dikonfirmasi) ---------- */
  let alarmOn = false, alarmToken = 0;
  async function startAlarm({ style = 'siren', volume = 80, text = '', tts = true, onCycle } = {}) {
    stopAlarm();
    alarmOn = true;
    const my = ++alarmToken;
    const vol = Math.max(.05, volume / 100);
    while (alarmOn && my === alarmToken) {
      onCycle && onCycle('tone');
      let d = 0;
      if (style === 'siren') d = siren(vol);
      else if (style === 'chime') d = chime(vol);
      else d = 0;
      if (d) await wait(d + 150);
      if (!alarmOn || my !== alarmToken) break;
      if (tts || style === 'voice') { onCycle && onCycle('voice'); await speak(text, vol); }
      if (!alarmOn || my !== alarmToken) break;
      await wait(1200);
    }
  }
  function stopAlarm() {
    alarmOn = false; alarmToken++;
    try { speechSynthesis.cancel(); } catch (e) { /* */ }
  }
  const isAlarming = () => alarmOn;

  async function testSpeaker({ style, volume, babyName }) {
    const vol = volume / 100;
    if (style === 'siren') { siren(vol); await wait(2100); }
    else if (style === 'chime') { chime(vol); await wait(1900); }
    await speak(`Tes speaker. Ini suara peringatan AI Baby Monitor untuk ${babyName}.`, vol);
  }

  /* ---------- Lagu tidur (domain publik) — diputar per nada lewat gain sendiri agar bisa dihentikan seketika ---------- */
  const NF = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880 };
  const TRACKS = {
    twinkle: { name: 'Twinkle Twinkle', beat: .5, notes: 'C5 C5 G5 G5 A5 A5 G5- F5 F5 E5 E5 D5 D5 C5- G5 G5 F5 F5 E5 E5 D5- G5 G5 F5 F5 E5 E5 D5- C5 C5 G5 G5 A5 A5 G5- F5 F5 E5 E5 D5 D5 C5- _ _'.split(' ') },
    brahms: { name: 'Brahms Lullaby', beat: .45, notes: 'E4 E4 G4- E4 E4 G4- E4 G4 C5 B4- A4 A4 G4- D4 E4 F4- D4 D4 E4 F4- D4 F4 B4 A4 G4 B4 C5- _ _'.split(' ') },
    nina: { name: 'Nina Bobo', beat: .48, notes: 'E4 F4 G4- A4 G4 F4 E4 D4- G4 A4 B4- C5 B4 A4 G4- E4 F4 G4- A4 G4 F4 E4 D4- G4 B4 D5 C5 B4 A4 G4 C5- _ _'.split(' ') },
    noise: { name: 'White noise', noise: 'pink' },
    rain: { name: 'Hujan lembut', noise: 'rain' },
    womb: { name: 'Detak jantung ibu', noise: 'womb' },
  };
  const lull = { on: false, track: null, vol: .7, gain: null, timer: null, src: null, tok: 0 };

  function lullStop() {
    lull.on = false; lull.tok++;
    clearTimeout(lull.timer);
    const c = ac, g = lull.gain, src = lull.src;
    lull.gain = null; lull.src = null;
    if (c && g) {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + .25);
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, 400);
      if (src) try { src.stop(t + .3); } catch (e) { /* */ }
    }
  }
  function lullPlay(track = 'twinkle') {
    lullStop();
    const c = ctx(); if (!c) return;
    const T = TRACKS[track] || TRACKS.twinkle;
    lull.on = true; lull.track = track;
    const my = lull.tok;
    const g = c.createGain(); g.gain.value = lull.vol; g.connect(master); lull.gain = g;
    if (T.noise) {
      const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048;
        const pat = T.noise === 'rain' ? (0.7 + 0.3 * Math.sin(i / (c.sampleRate * 0.45))) : 0.9;
        d[i] = (b0 + b1 + b2 + w * .05) * pat;
      }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = T.noise === 'womb' ? 420 : T.noise === 'rain' ? 1350 : 1800;
      const ng = c.createGain(); ng.gain.value = T.noise === 'womb' ? .48 : .35;
      src.connect(lp).connect(ng).connect(g); src.start(); lull.src = src;
      if (T.noise === 'womb') {
        const beat = () => {
          if (!lull.on || my !== lull.tok) return;
          const t = c.currentTime + .02;
          note(62, t, .09, { type: 'sine', vol: .28, attack: .02, release: .12, dest: g });
          note(54, t + .22, .11, { type: 'sine', vol: .20, attack: .02, release: .16, dest: g });
          lull.timer = setTimeout(beat, 920);
        };
        beat();
      }
      return;
    }
    let i = 0;
    const step = () => {
      if (!lull.on || my !== lull.tok) return;
      const n = T.notes[i % T.notes.length]; i++;
      const long = n.endsWith('-'), key = n.replace('-', '');
      const dur = T.beat * (long ? 2 : 1);
      if (key !== '_' && NF[key]) {
        const t = c.currentTime + .02;
        note(NF[key], t, dur * .8, { type: 'triangle', vol: .14, release: .5, dest: g });
        note(NF[key] / 2, t, dur * .8, { type: 'sine', vol: .06, release: .5, dest: g });
      }
      lull.timer = setTimeout(step, dur * 1000);
    };
    step();
  }
  function lullVol(v) { lull.vol = v; if (lull.gain && ac) lull.gain.gain.setTargetAtTime(v, ac.currentTime, .05); }
  const lullabyOn = () => lull.on;
  const lullabyTrack = () => lull.track;

  /* ---------- Audio kamar (dengar dari kamera, simulasi) ---------- */
  let roomNode = null, roomGain = null, cryTimer = null;
  function roomAudio(on) {
    const c = ctx(); if (!c) return;
    if (on && !roomNode) {
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
      roomNode = c.createBufferSource(); roomNode.buffer = buf; roomNode.loop = true;
      roomGain = c.createGain(); roomGain.gain.value = .25;
      roomNode.connect(roomGain).connect(master); roomNode.start();
    } else if (!on && roomNode) {
      try { roomNode.stop(); } catch (e) { /* */ }
      roomNode = null; roomGain = null;
      clearInterval(cryTimer); cryTimer = null;
    }
  }
  function cryWail() {
    const c = ctx(); if (!c || !roomNode) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.2;
    lfo.frequency.value = 7; lg.gain.value = 18; lfo.connect(lg).connect(o.frequency);
    o.frequency.setValueAtTime(380, t);
    o.frequency.linearRampToValueAtTime(520, t + .25);
    o.frequency.linearRampToValueAtTime(470, t + .7);
    o.frequency.linearRampToValueAtTime(330, t + 1.0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .08);
    g.gain.setValueAtTime(.09, t + .8); g.gain.linearRampToValueAtTime(0, t + 1.05);
    o.connect(bp).connect(g).connect(master);
    o.start(t); lfo.start(t); o.stop(t + 1.1); lfo.stop(t + 1.1);
  }
  function setCrying(on) {
    if (on && roomNode && !cryTimer) { cryWail(); cryTimer = setInterval(cryWail, 1500); }
    if (!on && cryTimer) { clearInterval(cryTimer); cryTimer = null; }
  }

  return { unlock, beep, speak, startAlarm, stopAlarm, isAlarming, testSpeaker, lullPlay, lullStop, lullVol, lullabyOn, lullabyTrack, TRACKS, get lullVolume() { return lull.vol; }, roomAudio, setCrying };
})();
