/* Mesin AI (SIMULASI). Di produksi: Cloud AI Server (OpenCV/TensorFlow/PyTorch) mengirim hasil deteksi lewat API.
   Di sini: kondisi bayi disimulasikan -> sensor (suara/gerakan/napas) dihitung -> detektor -> peringatan. */
const Engine = (() => {
  const TYPES = {
    cry: {
      label: 'Bayi Menangis', short: 'Tangisan', level: 'warning', icon: 'volume', color: 'warn',
      desc: 'Tangisan terdeteksi selama beberapa detik.',
      speak: n => `Perhatian. ${n} sedang menangis. Mohon segera cek kamar bayi.`,
    },
    motion: {
      label: 'Gerakan Berlebih', short: 'Gerakan', level: 'warning', icon: 'move', color: 'warn',
      desc: 'Gerakan terus-menerus di luar kebiasaan.',
      speak: n => `Perhatian. ${n} banyak bergerak dan gelisah. Mohon cek kamar bayi.`,
    },
    position: {
      label: 'Posisi Berbahaya', short: 'Posisi', level: 'critical', icon: 'rotate', color: 'bad',
      desc: 'Wajah tidak terlihat kamera. Segera telentangkan bayi.',
      speak: n => `Peringatan darurat. ${n} terdeteksi tengkurap. Segera ke kamar bayi sekarang.`,
    },
    vomit: {
      label: 'Indikasi Muntah', short: 'Muntah', level: 'critical', icon: 'droplet', color: 'bad',
      desc: 'Terdeteksi pola menyerupai muntahan. Periksa jalan napas.',
      speak: n => `Peringatan darurat. Terdeteksi indikasi muntah pada ${n}. Segera ke kamar bayi.`,
    },
    breath: {
      label: 'Napas Tidak Normal', short: 'Napas', level: 'critical', icon: 'wind', color: 'bad',
      desc: 'Gerakan dada tidak teratur. Bukan diagnosis medis.',
      speak: n => `Peringatan darurat. Pola napas ${n} tidak normal. Segera periksa bayi.`,
    },
    wake: {
      label: 'Bayi Terbangun', short: 'Bangun', level: 'info', icon: 'sun', color: 'info',
      desc: 'Mata terbuka dan mulai aktif.',
      speak: n => `${n} sudah bangun.`,
    },
    camera: {
      label: 'Kamera Offline', short: 'Kamera', level: 'warning', icon: 'cctv', color: 'warn',
      desc: 'Video terputus. Menyambung ulang otomatis.',
      speak: () => `Perhatian. Kamera kamar bayi terputus. Mohon cek kamera.`,
    },
  };

  const STATUS = {
    sleep: { text: 'Tidur nyenyak', sub: 'Napas teratur · semua aman', tone: 'ok', icon: 'moon', ai: 'TIDUR' },
    awake: { text: 'Terbangun', sub: 'Mata terbuka · gerakan ringan', tone: 'info', icon: 'sun', ai: 'BANGUN' },
    cry: { text: 'Menangis', sub: 'Tangisan terdeteksi', tone: 'warn', icon: 'volume', ai: 'MENANGIS' },
    move: { text: 'Gelisah', sub: 'Gerakan di atas normal', tone: 'warn', icon: 'move', ai: 'GELISAH' },
    prone: { text: 'Posisi tengkurap', sub: 'Wajah tidak terlihat — segera cek', tone: 'bad', icon: 'rotate', ai: 'TENGKURAP' },
    vomit: { text: 'Indikasi muntah', sub: 'Periksa jalan napas bayi', tone: 'bad', icon: 'droplet', ai: 'MUNTAH?' },
    distress: { text: 'Napas tidak normal', sub: 'Segera periksa bayi', tone: 'bad', icon: 'wind', ai: 'NAPAS ABNORMAL' },
    offline: { text: 'Kamera offline', sub: 'Menyambung ulang…', tone: 'muted', icon: 'wifiOff', ai: '-' },
    paused: { text: 'Pemantauan dijeda', sub: 'Alarm otomatis nonaktif', tone: 'muted', icon: 'pause', ai: 'JEDA' },
  };

  const PROFILES = {
    sleep: { m: [2, 7], db: [31, 37], rpm: [30, 36] },
    awake: { m: [14, 28], db: [40, 48], rpm: [36, 44] },
    cry: { m: [35, 55], db: [74, 88], rpm: [48, 58] },
    move: { m: [66, 92], db: [44, 54], rpm: [40, 50] },
    prone: { m: [8, 16], db: [33, 39], rpm: [34, 42] },
    vomit: { m: [28, 45], db: [52, 64], rpm: [44, 54] },
    distress: { m: [3, 10], db: [36, 42], rpm: [62, 74] },
  };
  const SENS_DELAY = { tinggi: 1, sedang: 2, rendah: 4 };

  const sim = { state: 'sleep', since: Date.now(), camOnline: true, internet: true, forceNight: null };
  const live = { db: 34, motion: 4, rpm: 33, pose: 'Telentang', status: 'sleep', conf: 97, latency: 1.1 };
  const hist = { db: [], motion: [], rpm: [] };
  const held = {}, active = {}, clearFor = {};
  const listeners = {};
  let autoDemo = false, autoTimer = null, autoReturn = null;

  const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  const emit = (ev, data) => (listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

  const rnd = ([a, b]) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;

  function setBaby(state) {
    sim.state = state; sim.since = Date.now();
    emit('sim', sim);
    tick(true);
  }
  function setCamera(onl) {
    sim.camOnline = onl;
    if (!onl) raise('camera');
    else { active.camera = false; emit('log', 'Kamera tersambung kembali'); }
    emit('sim', sim); tick(true);
  }
  function setInternet(onl) { sim.internet = onl; emit('sim', sim); emit('net', onl); }

  function isNight() {
    const mode = Store.s.settings.nightVision;
    if (sim.forceNight !== null) return sim.forceNight;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  }

  function cond(type) {
    switch (type) {
      case 'cry': return live.db >= 65;
      case 'motion': return live.motion >= 60;
      case 'position': return sim.state === 'prone';
      case 'vomit': return sim.state === 'vomit';
      case 'breath': return live.rpm >= 60 || live.rpm <= 18;
      case 'wake': return sim.state === 'awake';
      default: return false;
    }
  }

  function raise(type) {
    const T = TYPES[type];
    const ev = {
      id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type, level: T.level, ts: Date.now(), ack: false,
      latency: +(sim.internet ? 0.7 + Math.random() * 1.3 : 0.3 + Math.random() * .4).toFixed(1),
      via: sim.internet ? 'cloud' : 'gateway',
      snap: Camera.snapshot(400, .7),
      metrics: { db: Math.round(live.db), motion: Math.round(live.motion), rpm: Math.round(live.rpm) },
    };
    active[type] = true;
    Store.addEvent(ev);
    emit('log', `AI: ${T.label} (${T.level}) — latensi ${ev.latency} dtk via ${ev.via === 'cloud' ? 'Cloud' : 'Gateway lokal'}`);
    emit('alert', ev);
  }

  function tick(force) {
    const st = sim.state;
    const P = PROFILES[st];
    const k = force ? .55 : .35;
    live.db = lerp(live.db, rnd(P.db), k);
    live.motion = lerp(live.motion, rnd(P.motion || P.m), k);
    live.rpm = lerp(live.rpm, rnd(P.rpm), k * .8);
    live.pose = st === 'prone' ? 'Tengkurap' : (st === 'move' ? 'Berubah-ubah' : 'Telentang');
    live.conf = Math.round(rnd(st === 'prone' ? [86, 93] : [94, 99]));
    live.latency = +(sim.internet ? 0.8 + Math.random() * .8 : .3 + Math.random() * .3).toFixed(1);

    ['db', 'motion', 'rpm'].forEach(key => { hist[key].push(live[key]); if (hist[key].length > 60) hist[key].shift(); });

    const armed = Store.s.armed;
    live.status = !sim.camOnline ? 'offline' : st;

    // update tampilan kamera
    Object.assign(Camera.view, {
      baby: st, rpm: live.rpm, online: sim.camOnline, night: isNight(),
      overlay: Store.s.settings.aiOverlay,
      ai: { label: `BAYI ${live.conf}%`, status: STATUS[live.status]?.ai || '', alert: ['bad', 'warn'].includes(STATUS[live.status]?.tone) },
    });
    Sound.setCrying(st === 'cry' && sim.camOnline);

    // detektor
    if (sim.camOnline && armed && !force) {
      const D = Store.s.settings.detect;
      Object.keys(D).forEach(type => {
        const cfg = D[type];
        if (!cfg.on) { held[type] = 0; return; }
        if (cond(type)) {
          held[type] = (held[type] || 0) + 1; clearFor[type] = 0;
          if (!active[type] && held[type] >= (SENS_DELAY[cfg.sens] || 2)) raise(type);
        } else {
          held[type] = 0;
          clearFor[type] = (clearFor[type] || 0) + 1;
          if (clearFor[type] >= 3) active[type] = false;
        }
      });
    }

    // akumulasi durasi tidur hari ini
    if (st === 'sleep' && sim.camOnline && !force) Store.s.stats.sleptToday += 1;

    emit('tick', live);
  }
  setInterval(() => tick(false), 1000);

  /* ---------- Demo otomatis ---------- */
  const DEMO_SEQ = ['awake', 'cry', 'move', 'prone', 'cry', 'vomit', 'awake', 'distress'];
  let demoIdx = 0;
  function setAutoDemo(v) {
    autoDemo = v;
    clearTimeout(autoTimer); clearTimeout(autoReturn);
    if (v) scheduleDemo();
    emit('sim', sim);
  }
  function scheduleDemo() {
    autoTimer = setTimeout(() => {
      if (!autoDemo) return;
      const st = DEMO_SEQ[demoIdx++ % DEMO_SEQ.length];
      emit('log', `Demo otomatis: kondisi → ${STATUS[st].text}`);
      setBaby(st);
      autoReturn = setTimeout(() => { if (autoDemo && sim.state === st) setBaby('sleep'); scheduleDemo(); }, 14000);
    }, 18000 + Math.random() * 10000);
  }

  /* Dipanggil saat orang tua konfirmasi: anggap bayi sudah ditangani */
  function resolveByParent() {
    const at = sim.state, since = sim.since;
    setTimeout(() => {
      if (sim.since !== since || at === 'sleep') return;   // kondisi sudah berubah oleh simulasi lain
      const next = at === 'cry' || at === 'move' ? 'awake' : 'sleep';
      setBaby(next); emit('log', 'Bayi sudah ditangani orang tua');
      const s2 = sim.since;
      if (next === 'awake') setTimeout(() => { if (sim.since === s2) setBaby('sleep'); }, 9000);
    }, 1500);
  }

  return {
    TYPES, STATUS, sim, live, hist, on, emit, setBaby, setCamera, setInternet, setAutoDemo,
    get autoDemo() { return autoDemo; }, resolveByParent, isNight,
  };
})();
