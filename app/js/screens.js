/* =========================================================
   SEMUA LAYAR APLIKASI
   ========================================================= */

const PLANS = {
  bundle: {
    name: 'Paket Lengkap', tag: 'Kamera + speaker + app', price: 1299000, unit: 'sekali bayar',
    feats: ['Kamera AI 2K dengan night vision', 'Speaker alarm siap pakai', 'Premium 12 bulan gratis', 'Plug & play, cukup pindai QR'],
  },
  app: {
    name: 'Paket Aplikasi', tag: 'Pakai CCTV sendiri', price: 49000, unit: '/bulan', yearly: 490000,
    feats: ['CCTV milikmu (Tapo, Reolink, Ezviz, dll.)', 'Smart speaker, HP lama, atau Bluetooth', 'Semua fitur AI', '🆓 Uji coba gratis 14 hari'],
  },
};
const RTSP_PATHS = {
  'TP-Link Tapo': 'stream1', 'Reolink': 'h264Preview_01_main', 'Ezviz': 'H.264/ch1/main/av_stream',
  'Imou / Dahua': 'cam/realmonitor?channel=1&subtype=0', 'Hikvision': 'Streaming/Channels/101', 'Lainnya': 'stream',
};
const SPEAKER_TYPES = {
  bundle: { name: 'AI Baby Speaker', icon: 'speaker', desc: 'Speaker paket — LED + baterai cadangan' },
  camera: { name: 'Speaker bawaan kamera', icon: 'cctv', desc: 'Pakai fitur two-way audio kamera (volume terbatas)' },
  smart: { name: 'Smart speaker', icon: 'speaker', desc: 'Google Nest / Amazon Echo via integrasi akun' },
  phone: { name: 'HP / tablet lama', icon: 'phone', desc: 'Pasang aplikasi ini di “Mode Speaker” di dekat orang tua' },
  bluetooth: { name: 'Speaker Bluetooth', icon: 'bluetooth', desc: 'Tersambung ke HP ini (HP harus di dekat speaker)' },
};

const uid = () => Math.random().toString(36).slice(2, 9);
const initials = n => (String(n || 'B').replace(/[^A-Za-z ]/g, '').trim() || 'B').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const levelLabel = l => ({ critical: 'Darurat', warning: 'Peringatan', info: 'Info' }[l]);
const levelTone = l => ({ critical: 'bad', warning: 'warn', info: 'info' }[l]);

const isGuest = () => !Store.s.user;
function loginSheet(why = 'pakai fitur ini') {
  sheet(`<div class="lock-hero">${ic('lock', 28)}</div>
    <h3 class="sheet-title center">Masuk untuk melanjutkan</h3>
    <p class="muted center small">Akun dibutuhkan untuk ${why}.</p>
    <button class="btn btn-pri btn-lg" data-go="auth">Masuk</button>
    <button class="btn btn-soft btn-lg" data-go="auth" data-param='{"mode":"register"}'>Daftar gratis</button>
    <p class="fine center">Gratis · tanpa kartu kredit</p>`);
}
function topbar(title, { back = true, right = '', dark = false, sub = '' } = {}) {
  return `<header class="bar ${dark ? 'dark' : ''}">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Kembali">${ic('chevL', 22)}</button>` : '<span class="bar-sp"></span>'}
    <div class="bar-t"><h1>${title}</h1>${sub ? `<small>${sub}</small>` : ''}</div>
    ${right || '<span class="bar-sp"></span>'}
  </header>`;
}
function toggle(path, checked, after = '') {
  return `<label class="switch"><input type="checkbox" data-set="${path}" ${checked ? 'checked' : ''} ${after ? `data-after="${after}"` : ''}><i></i></label>`;
}
function seg(path, options, value, after = '') {
  const name = 'r' + uid();
  return `<div class="seg">${options.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" data-set="${path}" ${String(v) === String(value) ? 'checked' : ''} ${after ? `data-after="${after}"` : ''}><span>${l}</span></label>`).join('')}</div>`;
}
function eventRow(e) {
  const T = Engine.TYPES[e.type] || { label: e.type, icon: 'info' };
  const st = e.level === 'info' ? '' : e.falseAlarm ? `<span class="st st-muted">${ic('flag', 13)}</span>`
    : e.ack ? `<span class="st st-ok">${ic('check', 13)}</span>` : '<span class="st st-bad"><i></i></span>';
  const unread = e.ts > Store.s.readUpTo;
  return `<button class="ev-row ${unread ? 'unread' : ''}" data-go="eventDetail" data-param='${JSON.stringify({ id: e.id })}'>
    <span class="ev-ic tone-${levelTone(e.level)}">${ic(T.icon, 18)}</span>
    <span class="ev-main"><b>${T.label}</b><small>${fmtTime(e.ts)} · ${fmtAgo(e.ts)}</small></span>
    ${st}
  </button>`;
}
function groupByDay(list) {
  const out = []; let cur = null;
  list.forEach(e => { const d = fmtDay(e.ts); if (!cur || cur.d !== d) { cur = { d, items: [] }; out.push(cur); } cur.items.push(e); });
  return out;
}
function disclaimer() {
  return `<p class="fine center disc">${ic('info', 12)} Alat bantu pemantauan — bukan pengganti pengawasan orang tua dan bukan alat medis.</p>`;
}

/* ---------------- SPLASH & PIN LOCK ---------------- */
let pinUnlocked = false;
Screens.splash = {
  render: () => `<div class="splash">
    <div class="splash-logo">${logo(88, '#fff')}</div>
    <h1>AI Baby Monitor</h1>
    <p>Kamu santai, AI yang jaga</p>
    <div class="splash-load"><i></i></div>
  </div>`,
  mount() { setTimeout(() => { if (App.route.name === 'splash') App.go(nextEntry(), {}, { reset: true }); }, 1100); },
};
function nextEntry() {
  if (Store.s.settings.pin && !pinUnlocked) return 'pinLock';
  return 'home';
}

let pinBuf = '';
Screens.pinLock = {
  render: () => `<div class="pin-scr">
    <div class="pin-top">${ic('lock', 36)}<h2>Kunci Aplikasi</h2><p class="muted">Masukkan 4 digit PIN keamanan Anda</p></div>
    <div class="pin-dots" id="pin-dots">${[0, 1, 2, 3].map(i => `<i class="${i < pinBuf.length ? 'on' : ''}"></i>`).join('')}</div>
    <div class="pin-pad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="pin-k" data-act="pinKey" data-k="${n}">${n}</button>`).join('')}
      <button class="pin-k ghost" data-act="pinBio" aria-label="Biometrik">${ic('fingerprint', 26)}</button>
      <button class="pin-k" data-act="pinKey" data-k="0">0</button>
      <button class="pin-k ghost" data-act="pinDel" aria-label="Hapus">${ic('chevL', 24)}</button>
    </div>
    <p class="fine center">PIN standar demo: <b>${esc(Store.s.settings.pinCode || '1234')}</b></p>
  </div>`,
};
Actions.pinKey = el => {
  if (pinBuf.length >= 4) return;
  pinBuf += el.dataset.k;
  $$('#pin-dots i').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length));
  if (pinBuf.length === 4) {
    const target = Store.s.settings.pinCode || '1234';
    if (pinBuf === target) {
      pinBuf = ''; pinUnlocked = true;
      Sound.beep(.4);
      App.go('home', {}, { reset: true });
    } else {
      $('#pin-dots')?.classList.add('err');
      if (navigator.vibrate) try { navigator.vibrate([120, 60, 120]); } catch (e) { /* */ }
      toast('PIN salah, coba lagi', { icon: 'alert', tone: 'bad' });
      setTimeout(() => { pinBuf = ''; App.refresh(); }, 450);
    }
  }
};
Actions.pinDel = () => { pinBuf = pinBuf.slice(0, -1); $$('#pin-dots i').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length)); };
Actions.pinBio = () => {
  pinBuf = ''; pinUnlocked = true;
  toast('Terverifikasi dengan Face ID / Biometrik', { icon: 'shield', tone: 'ok' });
  App.go('home', {}, { reset: true });
};

/* ---------------- ONBOARDING ---------------- */
const OB = [
  { icon: 'video', title: 'Pantau Bayi dari Mana Saja', text: 'Lihat kamar bayi secara langsung 24 jam — jernih di siang hari, tetap terlihat di malam hari dengan night vision.', chips: ['Live 2K', 'Night vision', 'Audio dua arah'] },
  { icon: 'sparkles', title: 'AI yang Ikut Berjaga', text: 'AI mendeteksi tangisan, gerakan berlebih, posisi tengkurap, hingga indikasi muntah atau napas tidak normal.', chips: ['Tangisan', 'Posisi', 'Muntah', 'Napas'] },
  { icon: 'volume', title: 'Alarm Langsung ke Speaker', text: 'Saat ada anomali, speaker di dekat Anda berbunyi dalam hitungan detik — Anda bisa beraktivitas dengan tenang.', chips: ['< 5 detik', 'Multi-pengguna', 'Tetap jalan tanpa internet'] },
];
Screens.onboarding = {
  render: ({ i = 0 }) => {
    const o = OB[i];
    return `<div class="ob">
      <button class="ob-skip" data-act="obDone">Lewati</button>
      <div class="ob-art ob-art-${i}">
        <div class="ob-orb">${ic(o.icon, 64)}</div>
        <div class="ob-float f1">${ic(['moon', 'volume', 'bell'][i], 20)}</div>
        <div class="ob-float f2">${ic(['heart', 'rotate', 'users'][i], 20)}</div>
      </div>
      <div class="ob-txt">
        <h1>${o.title}</h1>
        <p>${o.text}</p>
        <div class="chips">${o.chips.map(c => `<span class="chip chip-pri">${c}</span>`).join('')}</div>
      </div>
      <div class="ob-foot">
        <div class="dots">${OB.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        ${i < OB.length - 1
    ? `<button class="btn btn-pri btn-lg" data-go="onboarding" data-param='{"i":${i + 1}}'>Lanjut ${ic('chevR', 18)}</button>`
    : `<button class="btn btn-pri btn-lg" data-act="obDone">Mulai Sekarang</button>`}
      </div>
    </div>`;
  },
};
Actions.obDone = () => { Store.s.onboarded = true; Store.save(); App.go('auth', {}, { reset: true }); };

/* ---------------- AUTH ---------------- */
Screens.auth = {
  render: ({ mode = 'login' }) => `${topbar('', { back: true })}<div class="auth">
    <div class="auth-hero">${logo(52)}<h1>${mode === 'login' ? 'Selamat datang kembali' : 'Buat akun baru'}</h1><p>Pantau si kecil bersama keluarga.</p></div>
    <div class="btn-row">
      <button class="btn btn-soft" data-act="social" data-p="Google">${ic('google', 18)} Google</button>
      <button class="btn btn-soft" data-act="social" data-p="Apple">${ic('apple', 18)} Apple</button>
    </div>
    <div class="or"><span>atau pakai email</span></div>
    <form class="form" id="auth-form" autocomplete="on">
      ${mode === 'register' ? `<label class="field"><span>Nama</span><input name="name" required placeholder="Rina Putri"></label>` : ''}
      <label class="field"><span>Email / No. HP</span><input name="email" required placeholder="nama@email.com" value="${mode === 'login' ? 'rina@email.com' : ''}"></label>
      <label class="field"><span>Password</span><input name="pass" type="password" required minlength="6" placeholder="min. 6 karakter" value="${mode === 'login' ? 'demo1234' : ''}"></label>
      <button class="btn btn-pri btn-lg" type="submit">${mode === 'login' ? 'Masuk' : 'Daftar'}</button>
    </form>
    <p class="center small">${mode === 'login' ? 'Belum punya akun? <a class="link" data-act="authMode" data-v="register">Daftar</a>' : 'Sudah punya akun? <a class="link" data-act="authMode" data-v="login">Masuk</a>'}</p>
    <p class="fine center">Mode demo · data hanya tersimpan di perangkat ini</p>
  </div>`,
  mount() {
    $('#auth-form').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      finishAuth({ name: String(f.get('name') || '').trim() || 'Rina Putri', email: String(f.get('email')).trim() });
    };
  },
};
function finishAuth(user) {
  Store.s.user = { ...user, phone: '0812-3456-7890', role: 'Pemilik akun' };
  Store.save();
  toast(`Selamat datang, ${user.name.split(' ')[0]}`);
  App.go(Store.s.setupDone ? 'home' : 'plan', {}, { reset: true });
}
Actions.authMode = el => App.go('auth', { mode: el.dataset.v }, { replace: true });
Actions.social = el => finishAuth({ name: 'Rina Putri', email: `rina@${el.dataset.p.toLowerCase()}.com` });
Actions.forgot = () => toast('Tautan reset kata sandi dikirim ke email Anda', { icon: 'mail' });

/* ---------------- PILIH PAKET ---------------- */
Screens.plan = {
  render: ({ from }) => {
    const card = key => {
      const P = PLANS[key];
      return `<label class="plan ${key === 'bundle' ? 'plan-hero' : ''}">
        <input type="radio" name="plan" value="${key}" ${key === 'bundle' ? 'checked' : ''}>
        <div class="plan-in">
          ${key === 'bundle' ? '<span class="plan-ribbon">Paling praktis</span>' : ''}
          <div class="plan-head">
            <span class="plan-ic">${ic(key === 'bundle' ? 'package' : 'phone', 26)}</span>
            <div><b>${P.name}</b><small>${P.tag}</small></div>
            <span class="plan-radio"></span>
          </div>
          <div class="plan-price">${rupiah(P.price)} <small>${P.unit}</small>${P.yearly ? `<em>${rupiah(P.yearly)}/thn · hemat 2 bln</em>` : ''}</div>
          <ul>${P.feats.map(f => `<li>${ic('check', 16)}${f}</li>`).join('')}</ul>
        </div>
      </label>`;
    };
    return `${from ? topbar('Ganti Paket') : ''}
    <div class="pad">
      ${from ? '' : `<div class="page-hero"><span class="step-pill">1 / 4</span><h1>Pilih paket</h1><p>Paket lengkap dengan perangkat, atau gunakan CCTV milikmu.</p></div>`}
      <form id="plan-form">${card('bundle')}${card('app')}</form>
      <details class="code-box"><summary>${ic('gift', 18)} Punya kode aktivasi?</summary>
        <div class="row-input"><input id="act-code" placeholder="cth. AIBM-7F3K-21QZ"><button class="btn btn-pri" data-act="activationCode">Aktifkan</button></div>
      </details>
      <button class="btn btn-pri btn-lg mt" data-act="choosePlan">Lanjutkan</button>
      ${from ? '' : '<button class="btn btn-ghost" data-go="home" data-reset="1">Nanti saja</button>'}
      <p class="fine center">*Harga contoh prototipe</p>
    </div>`;
  },
};
Actions.choosePlan = () => {
  const v = $('#plan-form input[name=plan]:checked').value;
  const changing = !!Store.s.plan;
  Store.s.plan = v; Store.save();
  if (changing && Store.s.setupDone) { toast(`Paket diganti ke ${PLANS[v].name}`); App.back(); return; }
  App.go('setup', { step: 'camera' });
};
Actions.activationCode = () => {
  const c = $('#act-code').value.trim();
  if (c.length < 6) { toast('Kode aktivasi tidak valid', { icon: 'alert', tone: 'bad' }); return; }
  Store.s.plan = 'bundle'; Store.save();
  toast('Kode valid — Paket Lengkap aktif (Premium 12 bulan)', { icon: 'gift', tone: 'ok' });
  App.go('setup', { step: 'camera' });
};

/* ---------------- SETUP PERANGKAT ---------------- */
const Setup = { tmp: {} };
const STEPS = ['camera', 'speaker', 'baby', 'done'];
function stepHead(step, add) {
  const n = STEPS.indexOf(step) + 2;
  return add ? topbar(step === 'camera' ? 'Tambah Kamera' : 'Tambah Speaker')
    : `<header class="bar">${step !== 'camera' ? `<button class="icon-btn" data-act="back">${ic('chevL', 22)}</button>` : '<span class="bar-sp"></span>'}
      <div class="progress"><i style="width:${(n / 5) * 100}%"></i></div><span class="step-n">${Math.min(n, 4)}/4</span></header>`;
}
Screens.setup = {
  render: ({ step = 'camera', add = false, phase = 'start' }) => {
    const bundle = Store.s.plan === 'bundle';
    if (step === 'camera') return stepHead(step, add) + `<div class="pad">${bundle && !Setup.tmp.forceRtsp ? camBundle(phase) : camRtsp(phase)}</div>`;
    if (step === 'speaker') return stepHead(step, add) + `<div class="pad">${speakerStep(phase === 'own' ? 'start' : phase, bundle && phase !== 'own' && !add, add)}</div>`;
    if (step === 'baby') return stepHead(step, add) + `<div class="pad">${babyForm(true)}</div>`;
    return `<div class="pad done-wrap">
      <div class="done-badge">${ic('check', 46)}</div>
      <h1>Semua siap</h1>
      <p class="muted">AI kini memantau <b>${esc(Store.s.baby.name)}</b> 24/7.</p>
      <div class="card list">
        ${Store.s.cameras.map(c => `<div class="li">${ic('cctv', 20)}<span><b>${esc(c.name)}</b><small>${esc(c.brand)} · ${c.type === 'rtsp' ? 'RTSP' : 'Cloud'}</small></span><span class="chip chip-ok">Online</span></div>`).join('')}
        ${Store.s.speakers.map(s => `<div class="li">${ic(SPEAKER_TYPES[s.type].icon, 20)}<span><b>${esc(s.name)}</b><small>${SPEAKER_TYPES[s.type].name}</small></span><span class="chip chip-ok">Online</span></div>`).join('')}
      </div>
      <div class="tip"><span>Kamera masih <b>simulasi</b>. Picu kejadian lewat Panel Simulasi.</span></div>
      <button class="btn btn-pri btn-lg" data-act="finishSetup">Mulai memantau</button>
    </div>`;
  },
  mount({ step = 'camera', phase }) {
    if (step === 'camera' && phase === 'scan') setTimeout(() => { if (App.route.params.phase === 'scan') App.go('setup', { ...App.route.params, phase: 'found' }, { replace: true }); }, 2300);
    if (step === 'camera' && phase === 'discover') setTimeout(() => { if (App.route.params.phase === 'discover') App.go('setup', { ...App.route.params, phase: 'list' }, { replace: true }); }, 2000);
    if (phase === 'connecting') runChecks();
    if (step === 'baby') bindBabyForm(true);
  },
};

function camBundle(phase) {
  if (phase === 'scan') return `<div class="page-hero"><h1>Memindai QR…</h1><p>Arahkan ke stiker QR di bawah kamera.</p></div>
    <div class="scanner"><div class="scan-frame">${ic('qr', 120)}<i class="scan-line"></i></div></div>`;
  if (phase === 'found') return `<div class="page-hero"><h1>Kamera ditemukan</h1><p>Hubungkan ke Wi-Fi rumah (2.4 GHz).</p></div>
    <div class="card dev-found">${ic('cctv', 28)}<div><b>AI Baby Cam C1</b><small>SN: AIBM-7F3K21 · Firmware 1.4.2</small></div><span class="chip chip-ok">Terdeteksi</span></div>
    <form class="form" id="wifi-form">
      <label class="field"><span>Nama Wi-Fi</span><select name="ssid"><option>Rumah_Rina_2.4G</option><option>IndiHome-8821</option><option>Biznet_Home</option></select></label>
      <label class="field"><span>Kata sandi Wi-Fi</span><input name="pw" type="password" value="wifirumah123" required></label>
      <label class="field"><span>Nama kamera</span><input name="name" value="Kamar Bayi" required></label>
      <button class="btn btn-pri btn-lg" type="submit">Sambungkan</button>
    </form>`;
  if (phase === 'connecting') return checksView('Menyiapkan kamera', ['Mengirim data Wi-Fi ke kamera', 'Kamera tersambung ke Wi-Fi', 'Mendaftarkan ke Cloud AI (terenkripsi)', 'Mengaktifkan model deteksi AI', 'Menerima video pertama']);
  if (phase === 'ok') return camOk();
  return `<div class="page-hero"><span class="step-pill">2 / 4</span><h1>Hubungkan kamera</h1><p>Nyalakan kamera, tunggu lampu biru berkedip, lalu pindai QR.</p></div>
    <div class="illu-cam">
      <div class="illu-device">${ic('cctv', 70)}<i class="blink-led"></i></div>
      <div class="illu-steps"><span><b>1</b>Colokkan</span><span><b>2</b>Lampu biru</span><span><b>3</b>Pindai QR</span></div>
    </div>
    <button class="btn btn-pri btn-lg" data-act="camScan">${ic('qr', 20)} Pindai QR Kamera</button>
    <button class="btn btn-ghost" data-act="useRtsp">Pakai CCTV lain (RTSP/ONVIF)</button>`;
}
function camRtsp(phase) {
  const t = Setup.tmp;
  if (phase === 'discover') return `<div class="page-hero"><h1>Mencari kamera…</h1><p>Memindai jaringan rumah (ONVIF).</p></div>
    <div class="radar"><i></i><i></i><i></i>${ic('wifi', 40)}</div>`;
  if (phase === 'list') return `<div class="page-hero"><h1>2 kamera ditemukan</h1><p>Pilih kamera yang mengarah ke boks bayi.</p></div>
    <div class="list-cards">
      <button class="card pick" data-act="pickOnvif" data-b="TP-Link Tapo" data-ip="192.168.1.100" data-m="Tapo C220">${ic('cctv', 26)}<span><b>TP-Link Tapo C220</b><small>192.168.1.100 · ONVIF · 2K</small></span>${ic('chevR', 18)}</button>
      <button class="card pick" data-act="pickOnvif" data-b="Reolink" data-ip="192.168.1.104" data-m="Reolink E1 Pro">${ic('cctv', 26)}<span><b>Reolink E1 Pro</b><small>192.168.1.104 · ONVIF · 4MP</small></span>${ic('chevR', 18)}</button>
    </div>
    <button class="btn btn-ghost" data-act="rtspManual">Isi manual saja</button>`;
  if (phase === 'connecting') return checksView('Menguji koneksi kamera', ['Ping kamera di jaringan lokal', 'Autentikasi RTSP', 'Stream video H.264 diterima', 'Stream audio diterima', 'Menghubungkan ke Cloud AI']);
  if (phase === 'ok') return camOk();
  const brand = t.brand || 'TP-Link Tapo';
  return `<div class="page-hero"><span class="step-pill">2 / 4</span><h1>Hubungkan CCTV</h1><p>Mendukung RTSP/ONVIF dan berada di Wi-Fi yang sama.</p></div>
    <button class="card pick accent" data-act="onvifScan">${ic('search', 24)}<span><b>Cari otomatis (ONVIF)</b><small>Temukan kamera di jaringan rumah</small></span>${ic('chevR', 18)}</button>
    <div class="or"><span>atau isi manual</span></div>
    <form class="form" id="rtsp-form">
      <label class="field"><span>Merek kamera</span><select name="brand" id="rtsp-brand">${Object.keys(RTSP_PATHS).map(b => `<option ${b === brand ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
      <div class="grid2">
        <label class="field"><span>Alamat IP</span><input name="ip" value="${esc(t.ip || '192.168.1.100')}" required pattern="^\\d{1,3}(\\.\\d{1,3}){3}$"></label>
        <label class="field"><span>Port</span><input name="port" value="554" inputmode="numeric" required></label>
      </div>
      <div class="grid2">
        <label class="field"><span>Username</span><input name="user" value="admin" required></label>
        <label class="field"><span>Password</span><input name="pass" type="password" value="kamera123" required></label>
      </div>
      <label class="field"><span>Nama kamera</span><input name="name" value="Kamar Bayi" required></label>
      <div class="code" id="rtsp-preview"></div>
      <button class="btn btn-pri btn-lg" type="submit">Tes & Sambungkan</button>
    </form>
    <p class="fine">Password kamera disimpan terenkripsi.</p>`;
}
function camOk() {
  const cam = Store.s.cameras[Store.s.cameras.length - 1];
  return `<div class="page-hero"><h1>Kamera terhubung</h1><p>Pastikan seluruh boks terlihat.</p></div>
    <div class="cam-card"><canvas class="cam"></canvas><span class="live-pill"><i></i>LIVE</span><span class="cam-name">${esc(cam?.name || '')}</span></div>
    <div class="tip"><span>Posisi ideal: 1–1,5 m dari bayi, dari atas atau samping boks.</span></div>
    <button class="btn btn-pri btn-lg" data-act="camNext">Lanjut</button>`;
}
function checksView(title, items) {
  return `<div class="page-hero"><h1>${title}</h1><p>Mohon tunggu…</p></div>
    <div class="checks">${items.map((t, i) => `<div class="chk" data-i="${i}"><span class="chk-ic"><i class="spin"></i></span><span>${t}</span></div>`).join('')}</div>`;
}
function runChecks() {
  const rows = $$('.chk'); let i = 0;
  const step = () => {
    if (!rows[i] || !rows[i].isConnected) { if (i >= rows.length) setTimeout(checksDone, 500); return; }
    rows[i].classList.add('run');
    setTimeout(() => { if (!rows[i].isConnected) return; rows[i].classList.remove('run'); rows[i].classList.add('ok'); rows[i].querySelector('.chk-ic').innerHTML = ic('check', 16); i++; step(); }, 550 + Math.random() * 500);
  };
  step();
}
function checksDone() {
  const p = App.route.params;
  if (p.step === 'camera') {
    const t = Setup.tmp, bundle = Store.s.plan === 'bundle' && !t.forceRtsp;
    Store.s.cameras = Store.s.cameras.filter(c => !c.demo);
    Store.s.cameras.push(bundle
      ? { id: uid(), name: t.name || 'Kamar Bayi', room: t.name || 'Kamar Bayi', type: 'cloud', brand: 'AI Baby Cam C1', status: 'online', res: '2K', wifi: t.ssid || 'Rumah_Rina_2.4G', sn: 'AIBM-7F3K21' }
      : { id: uid(), name: t.name || 'Kamar Bayi', room: t.name || 'Kamar Bayi', type: 'rtsp', brand: t.model || t.brand || 'TP-Link Tapo', status: 'online', res: '1080p', url: t.url });
    Store.save();
    Camera.view.camName = `CAM-0${Store.s.cameras.length} · ${Store.s.cameras[0].name}`;
    App.go('setup', { ...p, phase: 'ok' }, { replace: true });
  } else if (p.step === 'speaker') {
    const type = Setup.tmp.spk;
    Store.s.speakers = Store.s.speakers.filter(c => !c.demo);
    Store.s.speakers.push({ id: uid(), name: Setup.tmp.spkName || SPEAKER_TYPES[type].name, type, volume: 90, status: 'online' });
    Store.save(); SpeakerUI.idle();
    App.go('setup', { ...p, phase: 'ok' }, { replace: true });
  }
}
Actions.camScan = () => App.go('setup', { ...App.route.params, phase: 'scan' }, { replace: true });
Actions.useRtsp = () => { Setup.tmp.forceRtsp = true; App.go('setup', { ...App.route.params, phase: 'start' }, { replace: true }); };
Actions.onvifScan = () => App.go('setup', { ...App.route.params, phase: 'discover' }, { replace: true });
Actions.rtspManual = () => App.go('setup', { ...App.route.params, phase: 'start' }, { replace: true });
Actions.pickOnvif = el => {
  Object.assign(Setup.tmp, { brand: el.dataset.b, ip: el.dataset.ip, model: el.dataset.m });
  App.go('setup', { ...App.route.params, phase: 'start' }, { replace: true });
  toast(`${el.dataset.m} dipilih — masukkan akun kamera`, { icon: 'cctv' });
};
Actions.camNext = () => {
  const p = App.route.params;
  if (p.add) { Setup.tmp = {}; App.go('devices', {}, { replace: true }); return; }
  App.go('setup', { step: 'speaker' });
};
// form handler setup (didelegasikan)
document.addEventListener('submit', e => {
  if (e.target.id === 'wifi-form') {
    e.preventDefault(); const f = new FormData(e.target);
    Object.assign(Setup.tmp, { ssid: f.get('ssid'), name: f.get('name') });
    App.go('setup', { ...App.route.params, phase: 'connecting' }, { replace: true });
  }
  if (e.target.id === 'rtsp-form') {
    e.preventDefault(); const f = new FormData(e.target);
    const brand = f.get('brand');
    Object.assign(Setup.tmp, { brand, name: f.get('name'), ip: f.get('ip'), url: `rtsp://${f.get('user')}:••••••@${f.get('ip')}:${f.get('port')}/${RTSP_PATHS[brand]}` });
    if (!Setup.tmp.model || !Setup.tmp.model.startsWith(brand.split(' ').pop())) Setup.tmp.model = brand;
    App.go('setup', { ...App.route.params, phase: 'connecting' }, { replace: true });
  }
});
document.addEventListener('input', e => { if (e.target.closest('#rtsp-form')) updRtspPreview(); });
document.addEventListener('change', e => { if (e.target.closest('#rtsp-form')) updRtspPreview(); });
function updRtspPreview() {
  const f = $('#rtsp-form'); if (!f) return;
  const d = new FormData(f);
  $('#rtsp-preview').textContent = `rtsp://${d.get('user')}:••••••@${d.get('ip')}:${d.get('port')}/${RTSP_PATHS[d.get('brand')]}`;
}
const _setupMount = Screens.setup.mount;
Screens.setup.mount = (p, root) => { _setupMount(p, root); updRtspPreview(); };

function speakerStep(phase, bundle, add = false) {
  if (phase === 'connecting') return checksView('Menyambungkan speaker', bundle
    ? ['Mencari AI Baby Speaker via Bluetooth', 'Memasangkan ke kamera', 'Menghubungkan ke Wi-Fi', 'Sinkronisasi pola alarm']
    : ['Mendeteksi perangkat', 'Otorisasi akses', 'Menguji pemutaran suara', 'Mendaftarkan rute alarm']);
  if (phase === 'ok') {
    const sp = Store.s.speakers[Store.s.speakers.length - 1];
    return `<div class="page-hero"><h1>Speaker siap</h1><p>Uji bunyi untuk memastikan terdengar dari tempatmu.</p></div>
      <div class="spk-hero"><div class="spk-dev big" data-state="idle"><i class="led"></i><i class="grill"></i></div><b>${esc(sp?.name)}</b><small data-spk-label>Standby — siap membunyikan alarm</small></div>
      <button class="btn btn-soft btn-lg" data-act="testSpeaker">${ic('volume', 20)} Tes Bunyi Alarm</button>
      <button class="btn btn-pri btn-lg" data-act="spkNext">Lanjut</button>`;
  }
  if (bundle) return `<div class="page-hero"><span class="step-pill">3 / 4</span><h1>Pasang speaker alarm</h1><p>Letakkan di ruangan tempat kamu beraktivitas.</p></div>
    <div class="spk-hero"><div class="spk-dev big" data-state="pair"><i class="led"></i><i class="grill"></i></div><b>AI Baby Speaker</b><small>Lampu berkedip = siap dipasangkan</small></div>
    <label class="field"><span>Lokasi speaker</span><select id="spk-loc"><option>Ruang Keluarga</option><option>Dapur</option><option>Kamar Orang Tua</option><option>Ruang Kerja</option></select></label>
    <button class="btn btn-pri btn-lg" data-act="spkConnect" data-t="bundle">Pasangkan Speaker</button>
    <button class="btn btn-ghost" data-act="spkOwn">Pakai speaker lain</button>`;
  return `<div class="page-hero"><span class="step-pill">3 / 4</span><h1>Pilih speaker alarm</h1><p>Pilih speaker yang paling dekat denganmu.</p></div>
    <div class="list-cards">${(add ? ['bundle', 'smart', 'phone', 'camera', 'bluetooth'] : ['smart', 'phone', 'camera', 'bluetooth']).map((k, i) => `<label class="card pick radio-card">
      <input type="radio" name="spk" value="${k}" ${i === 0 ? 'checked' : ''}>${ic(SPEAKER_TYPES[k].icon, 26)}<span><b>${SPEAKER_TYPES[k].name}</b><small>${SPEAKER_TYPES[k].desc}</small></span><i class="rc"></i></label>`).join('')}</div>
    <button class="btn btn-pri btn-lg" data-act="spkConnect">Sambungkan</button>`;
}
Actions.spkOwn = () => App.go('setup', { ...App.route.params, phase: 'own' }, { replace: true });
Actions.spkConnect = el => {
  const type = el.dataset.t || $('input[name=spk]:checked')?.value || 'smart';
  Setup.tmp.spk = type;
  const loc = $('#spk-loc')?.value;
  Setup.tmp.spkName = type === 'bundle' ? `AI Baby Speaker · ${loc || 'Ruang Keluarga'}` : type === 'smart' ? 'Google Nest Mini · Ruang Keluarga' : type === 'phone' ? 'HP Lama (Mode Speaker)' : type === 'camera' ? 'Speaker Kamera Kamar Bayi' : 'JBL Go 3 (Bluetooth)';
  App.go('setup', { ...App.route.params, phase: 'connecting' }, { replace: true });
};
Actions.spkNext = () => {
  const p = App.route.params; Setup.tmp = {};
  if (p.add) { App.go('devices', {}, { replace: true }); return; }
  App.go('setup', { step: 'baby' });
};
Actions.testSpeaker = async el => {
  if (!Store.s.speakers.length) { toast('Belum ada speaker tersambung', { icon: 'volumeX', tone: 'bad' }); return; }
  if (el) el.disabled = true;
  SpeakerUI.ring('Tes speaker', 'info');
  const s = Store.s.settings.alarm;
  await Sound.testSpeaker({ style: s.sound, volume: s.volume, babyName: Store.s.baby.name });
  SpeakerUI.idle();
  if (el) el.disabled = false;
};

function babyAvatarHtml(cls = '') {
  const p = Store.s.baby.photo;
  return p ? `<img src="${p}" alt="Foto bayi" class="baby-photo">` : ic('baby', cls === 'sm' ? 26 : cls === 'who' ? 22 : 44);
}
function babyForm(setup) {
  const b = Store.s.baby;
  return `${setup ? '<div class="page-hero"><span class="step-pill">4 / 4</span><h1>Profil si kecil</h1><p>Agar AI dan pesan alarm lebih personal.</p></div>' : ''}
    <div class="baby-av" id="baby-av-box">${babyAvatarHtml()}<button class="mini-btn" type="button" data-act="pickBabyPhoto" aria-label="Ubah foto bayi">${ic('camera', 14)}</button><input type="file" id="baby-photo-in" accept="image/*" class="hidden"></div>
    <form class="form" id="baby-form">
      <label class="field"><span>Nama panggilan bayi</span><input name="name" value="${esc(b.name)}" required maxlength="24"></label>
      <label class="field"><span>Tanggal lahir</span><input name="birth" type="date" value="${b.birth}" max="${new Date().toISOString().slice(0, 10)}" required></label>
      <div class="field"><span>Jenis kelamin</span>
        <div class="seg"><label><input type="radio" name="gender" value="P" ${b.gender === 'P' ? 'checked' : ''}><span>Perempuan</span></label><label><input type="radio" name="gender" value="L" ${b.gender === 'L' ? 'checked' : ''}><span>Laki-laki</span></label></div></div>
      <label class="field"><span>Catatan kesehatan (opsional)</span><textarea name="note" rows="2" placeholder="cth. refluks, lahir prematur">${esc(b.note || '')}</textarea></label>
      <button class="btn btn-pri btn-lg" type="submit">${setup ? 'Simpan & Lanjut' : 'Simpan'}</button>
    </form>`;
}
function bindBabyForm(setup) {
  const inp = $('#baby-photo-in');
  if (inp) {
    inp.onchange = e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = 160; cv.height = 160;
          const s = Math.min(img.width, img.height);
          cv.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
          Store.s.baby.photo = cv.toDataURL('image/jpeg', .82);
          Store.save();
          App.refresh();
          toast('Foto si kecil diperbarui', { icon: 'camera', tone: 'ok' });
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    };
  }
  $('#baby-form').onsubmit = e => {
    e.preventDefault(); const f = new FormData(e.target);
    Object.assign(Store.s.baby, { name: String(f.get('name')).trim(), birth: f.get('birth'), gender: f.get('gender'), note: f.get('note') });
    Store.save();
    if (setup) App.go('setup', { step: 'done' }); else { toast('Profil bayi disimpan'); App.back(); }
  };
}
Actions.finishSetup = () => {
  Store.s.setupDone = true; Store.save();
  Sound.unlock();
  App.go('home', {}, { reset: true });
  setTimeout(() => toast('Pemantauan AI aktif 24/7', { icon: 'shield', tone: 'ok' }), 400);
};
Actions.pickBabyPhoto = () => $('#baby-photo-in')?.click();

/* ---------------- BERANDA ---------------- */
function todayEvents() { const t = new Date().toDateString(); return Store.s.events.filter(e => new Date(e.ts).toDateString() === t); }
const RING_C = 2 * Math.PI * 20;
function gauge(k, icon, label) {
  return `<div class="gg" data-metric="${k}">
    <div class="gg-ring"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" class="gg-bg"/><circle cx="24" cy="24" r="20" class="gg-fg" data-ring="${k}" stroke-dasharray="0 ${RING_C}"/></svg>
      <span class="gg-ic">${ic(icon, 16)}</span></div>
    <b data-b="${k}">-</b><small>${label}</small></div>`;
}
function sleepTimeline() {
  const now = new Date(), cur = now.getHours() + now.getMinutes() / 60;
  const P = [[0, 6.3, 's'], [6.3, 7.1, 'a'], [7.1, 9.4, 's'], [9.4, 11.8, 'a'], [11.8, 14.2, 's'], [14.2, 16.6, 'a'], [16.6, 17.9, 's'], [17.9, 19.4, 'a'], [19.4, 24, 's']];
  const segs = P.filter(([a]) => a < cur).map(([a, b, t]) => `<i class="seg-${t}" style="left:${a / 24 * 100}%;width:${(Math.min(b, cur) - a) / 24 * 100}%"></i>`).join('');
  const dots = todayEvents().filter(e => e.level !== 'info').map(e => { const d = new Date(e.ts); return `<em class="tl-dot ${levelTone(e.level)}" style="left:${(d.getHours() + d.getMinutes() / 60) / 24 * 100}%"></em>`; }).join('');
  return `<div class="tline"><div class="tl-track">${segs}${dots}<span class="tl-now" style="left:${cur / 24 * 100}%"></span></div>
    <div class="tl-lbl"><small>00</small><small>06</small><small>12</small><small>18</small><small>24</small></div></div>`;
}
function aiCopilotCard(score, wakes, alerts) {
  const s = Store.s, b = s.baby.name;
  const lastMilk = (s.careLog || []).find(c => c.type === 'milk');
  const milkAgoMin = lastMilk ? Math.round((Date.now() - lastMilk.ts) / 60000) : 120;
  const nextMilkIn = Math.max(15, 180 - milkAgoMin);
  const hot = Engine.live.roomTemp >= 28;
  const msg = hot
    ? `Suhu kamar <b>${Engine.live.roomTemp}°C</b> agak hangat. Idealnya 24–26°C agar ${esc(b)} tidak gelisah.`
    : alerts > 2
      ? `Tercatat ${alerts} peringatan hari ini. Pastikan selimut tidak menutupi dada & wajah ${esc(b)}.`
      : `Pola tidur ${esc(b)} stabil (skor ${score}). Estimasi menyusu berikutnya dalam <b>±${fmtDur(nextMilkIn * 60)}</b>.`;
  return `<div class="card copilot ${hot ? 'warn' : ''}" data-act="copilotSheet" role="button">
    <span class="cp-ic">${ic('sparkles', 20)}</span>
    <div class="cp-body"><b>Ringkasan AI Copilot</b><small>${msg}</small></div>
    ${ic('chevR', 18)}
  </div>`;
}
Actions.copilotSheet = () => {
  const s = Store.s, b = esc(s.baby.name);
  const lastMilk = (s.careLog || []).find(c => c.type === 'milk');
  const lastDiaper = (s.careLog || []).find(c => c.type === 'diaper');
  sheet(`<h3 class="sheet-title">${ic('sparkles', 20)} Analisis AI Copilot · ${b}</h3>
    <div class="card list">
      <div class="li">${ic('moon', 20)}<span><b>Prediksi Jendela Tidur Berikutnya</b><small>Berdasarkan usia ${babyAge(s.baby.birth)}, waktu bangun optimal 90–120 menit sebelum tidur siang.</small></span></div>
      <div class="li">${ic('bottle', 20)}<span><b>Jadwal Menyusu</b><small>Terakhir: ${lastMilk ? fmtAgo(lastMilk.ts) + ' (' + esc(lastMilk.detail) + ')' : 'Belum tercatat'} · Disarankan tiap 2,5–3 jam.</small></span></div>
      <div class="li">${ic('droplet', 20)}<span><b>Kondisi Popok</b><small>Terakhir diganti: ${lastDiaper ? fmtAgo(lastDiaper.ts) : 'Belum tercatat'}.</small></span></div>
      <div class="li">${ic('thermo', 20)}<span><b>Kenyamanan Kamar (${Engine.live.roomTemp}°C · ${Engine.live.roomHum}%)</b><small>${Engine.live.roomTemp >= 28 ? 'Suhu di atas 28°C — disarankan menyalakan AC/kipas lembut.' : 'Suhu dan kelembapan kamar berada di rentang nyaman (24–26°C).'}</small></span></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-soft" data-act="careSheet">${ic('plus', 16)} Catat Rawat</button>
      <button class="btn btn-pri" data-act="lullaby">${ic('music', 16)} Putar Penenang</button>
    </div>`);
};
Screens.home = {
  render() {
    const s = Store.s, guest = isGuest();
    const tEv = todayEvents();
    const alerts = tEv.filter(e => e.level !== 'info').length, wakes = tEv.filter(e => e.type === 'wake').length;
    const spk = s.speakers[0];
    const score = Math.max(40, Math.min(98, 95 - wakes * 4 - alerts * 6));
    const C = 2 * Math.PI * 26;
    const banner = guest
      ? `<button class="promo" data-go="auth"><span class="promo-ic">${ic('sparkles', 18)}</span><span><b>Mode demo</b><small>Hubungkan kamera milikmu</small></span><i>Masuk</i></button>`
      : !s.setupDone ? `<button class="promo" data-go="plan"><span class="promo-ic">${ic('cctv', 18)}</span><span><b>Hubungkan kamera</b><small>± 2 menit</small></span><i>Mulai</i></button>` : '';
    const dv = (icon, tone, go, label) => `<button class="dvc ${icon === 'volume' ? 'speaker-chip' : ''}" data-go="${go}" aria-label="${label}"><span>${ic(icon, 20)}<i class="dot ${tone}"></i></span><small>${label}</small></button>`;
    const evs = s.events.slice(0, 8);
    return `
    <header class="top">
      <div class="who">
        <span class="who-av" data-go="baby" role="button">${babyAvatarHtml('who')}</span>
        <div><div class="hello">${esc(s.baby.name)}</div><div class="hi-k">${babyAge(s.baby.birth)}</div></div>
      </div>
      <div class="top-act">
        <button class="icon-btn soft" data-act="careSheet" aria-label="Catat perawatan" title="Jurnal Perawatan">${ic('heart', 19)}</button>
        <button class="icon-btn soft" data-go="history" aria-label="Aktivitas">${ic('bell', 20)}<i class="dot-badge hidden" data-badge></i></button>
        ${guest ? `<button class="login-pill" data-go="auth">Masuk</button>` : `<button class="avatar" data-go="profile" aria-label="Profil">${initials(s.user?.name)}</button>`}
      </div>
    </header>
    <div class="pad-x">
      ${installCard()}
      ${banner}
      <div class="hero" data-go="live" data-reset="1" role="button" aria-label="Buka live view">
        <canvas class="cam"></canvas>
        <div class="hero-top">
          <span class="live-pill"><i></i>LIVE</span>
          <span class="pill">${ic('thermo', 11)} <b data-b="roomTemp">${Engine.live.roomTemp}</b>°C · <span data-b="roomHum">${Engine.live.roomHum}</span>%</span>
          ${Camera.view.mode === 'webcam' ? `<span class="pill ok-pill">${ic('camera', 11)} Kamera Asli</span>` : ''}
        </div>
        <div class="hero-bot" data-tone="ok">
          <span class="st-ic" data-b-icon="status" data-size="18"></span>
          <div><b data-b="status">-</b></div>
          <span class="hero-go">${ic('maximize', 16)}</span>
        </div>
      </div>

      <div class="gauges">
        ${gauge('db', 'volume', 'dB')}
        ${gauge('motion', 'move', 'gerak %')}
        ${gauge('rpm', 'wind', 'napas')}
        ${gauge('pose', 'rotate', 'posisi')}
      </div>

      <div class="rounds">
        <button class="rb ${Sound.lullabyOn() ? 'on' : ''}" data-act="lullaby" aria-label="Lagu tidur"><span>${ic('music', 22)}</span><small>${Sound.lullabyOn() ? 'Diputar' : 'Lagu'}</small></button>
        <button class="rb" data-act="talkSheet" aria-label="Bicara"><span>${ic('mic', 22)}</span><small>Bicara</small></button>
        <button class="rb" data-act="testSpeaker" aria-label="Tes alarm"><span>${ic('volume', 22)}</span><small>Tes</small></button>
        <button class="rb ${s.armed ? 'ok' : 'off'}" data-act="toggleArm" aria-label="AI"><span>${ic(s.armed ? 'shield' : 'pause', 22)}</span><small>${s.armed ? 'AI on' : 'AI off'}</small></button>
      </div>

      <div class="card sleep2" data-go="history" data-param='{"tab":"stats"}' role="button">
        <div class="sleep-top">
          <div class="ring sm">
            <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="ring-bg"/><circle cx="32" cy="32" r="26" class="ring-fg" stroke-dasharray="${(C * score / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>
            <div><b>${score}</b></div>
          </div>
          <div class="sl-pills">
            <span>${ic('moon', 15)}<b data-b="sleptToday">-</b></span>
            <span>${ic('sun', 15)}<b>${wakes}</b></span>
            <span class="${alerts ? 'w' : ''}">${ic('alert', 15)}<b>${alerts}</b></span>
          </div>
          <span class="muted-ic">${ic('chevR', 18)}</span>
        </div>
        ${sleepTimeline()}
      </div>

      ${aiCopilotCard(score, wakes, alerts)}

      <div class="sec-h"><h3>Terbaru</h3><a data-go="history">Semua</a></div>
      <div class="hscroll">${evs.map(e => {
        const T = Engine.TYPES[e.type];
        return `<button class="evc" data-go="eventDetail" data-param='${JSON.stringify({ id: e.id })}'>
          <span class="evc-ic tone-${levelTone(e.level)}">${ic(T.icon, 20)}</span>
          <b>${T.short}</b><small>${fmtTime(e.ts)}</small>
          ${!e.ack && e.level !== 'info' ? '<i class="evc-dot"></i>' : ''}</button>`;
      }).join('')}</div>
    </div>`;
  },
};
Actions.toggleArm = () => {
  Store.s.armed = !Store.s.armed; Store.save();
  toast(Store.s.armed ? 'Pemantauan AI aktif' : 'Pemantauan dijeda — alarm otomatis mati', { icon: Store.s.armed ? 'shield' : 'pause', tone: Store.s.armed ? 'ok' : 'warn' });
  SimPanel.log(Store.s.armed ? 'Pemantauan diaktifkan' : 'Pemantauan dijeda');
  App.refresh();
};
Actions.armChanged = el => {
  toast(el.checked ? 'Pemantauan AI diaktifkan' : 'Pemantauan dijeda — alarm otomatis mati', { icon: el.checked ? 'shield' : 'pause', tone: el.checked ? 'ok' : 'warn' });
  SimPanel.log(el.checked ? 'Pemantauan diaktifkan' : 'Pemantauan dijeda');
  App.refresh();
};
Actions.lullaby = () => Player.open();
Actions.talkSheet = () => sheet(`<h3 class="sheet-title">Bicara ke si kecil</h3>
  <div class="cam-card sm"><canvas class="cam"></canvas><span class="live-pill"><i></i>LIVE</span></div>
  ${talkButton()}
  <div class="phrases">${['Sssh… Bunda di sini', 'Tidur lagi ya, Nak', 'Ayah segera ke sana'].map(p => `<button class="chip chip-pri" data-act="phrase">${p}</button>`).join('')}</div>`, { onMount: bindTalk });
function talkButton() {
  return `<div class="talk-wrap"><button class="talk-btn" id="talk-btn">${ic('mic', 30)}</button><div class="talk-lbl" id="talk-lbl">Tahan untuk bicara</div><div class="talk-meter" id="talk-meter">${'<i></i>'.repeat(14)}</div></div>`;
}
function bindTalk(root) {
  const b = $('#talk-btn', root); if (!b) return;
  let iv = null, t0 = 0;
  const start = e => {
    e.preventDefault(); t0 = Date.now(); b.classList.add('on');
    $('#talk-lbl', root).textContent = 'Berbicara… lepas untuk berhenti';
    iv = setInterval(() => $$('#talk-meter i', root).forEach(i => { i.style.height = (6 + Math.random() * 26) + 'px'; }), 90);
  };
  const end = () => {
    if (!b.classList.contains('on')) return;
    b.classList.remove('on'); clearInterval(iv);
    $$('#talk-meter i', root).forEach(i => { i.style.height = '6px'; });
    $('#talk-lbl', root).textContent = 'Tahan untuk bicara';
    const d = ((Date.now() - t0) / 1000).toFixed(1);
    if (d > .4) toast(`Pesan suara ${d} dtk diputar di kamar bayi`, { icon: 'volume' });
  };
  b.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, end));
}
Actions.phrase = el => { Sound.speak(el.textContent, .8); toast('Diputar di speaker kamera: “' + el.textContent + '”', { icon: 'volume' }); };

/* ---------------- LIVE VIEW ---------------- */
let recTimer = null, recStart = 0, mediaRec = null, recChunks = [];
Screens.live = {
  dark: true,
  render() {
    const s = Store.s, cam = s.cameras[0];
    const night = Engine.isNight();
    const isWebcam = Camera.view.mode === 'webcam';
    const isRec = !!recTimer;
    const lc = (act, icon, label, on = false, cls = '') => `<button class="lc ${on ? 'on' : ''} ${cls}" data-act="${act}" aria-label="${label}">${ic(icon, 22)}<span>${label}</span></button>`;
    return `
    <header class="bar dark">
      <button class="icon-btn" data-act="camSourceSheet" aria-label="Sumber kamera" title="Sumber kamera">${ic(isWebcam ? 'camera' : 'cctv', 20)}</button>
      <div class="bar-t"><h1>${esc(cam?.name || 'Kamera')}</h1><small>${isWebcam ? 'Kamera & Mikrofon Asli' : 'Kamera Simulasi AI'}</small></div>
      ${isWebcam ? `<button class="icon-btn" data-act="flipCam" aria-label="Balik kamera">${ic('flip', 20)}</button>` : `<button class="icon-btn" data-act="camSourceSheet" aria-label="Ganti kamera">${ic('radio', 20)}</button>`}
    </header>
    <div class="live-wrap" id="live-wrap">
      <canvas class="cam"></canvas>
      <div class="live-top">
        <span class="live-pill"><i></i>LIVE</span>
        <span class="pill">${ic('activity', 12)} <span data-b="latency">-</span>s</span>
        <button class="pill btn-pill" data-act="zoomCycle" title="Digital Zoom">${ic('zoomIn', 12)} <b id="zoom-lbl">${Camera.view.zoom || 1}x</b></button>
        <button class="pill btn-pill" data-act="roiSheet" title="Zona Aman Boks">${ic('shield', 12)} Zona</button>
      </div>
      ${isRec ? `<div class="live-rec" id="live-rec"><i></i><span id="rec-time">00:00</span></div>` : ''}
      <button class="live-pip" data-act="pipToggle" aria-label="Picture in Picture" title="Layar Mengambang (PiP)">${ic('pip', 17)}</button>
      <button class="live-fs" data-act="fullscreen" aria-label="Layar penuh">${ic('maximize', 18)}</button>
      <div class="live-status" data-tone="ok"><span data-b-icon="status" data-size="16"></span><b data-b="status">-</b></div>
    </div>
    <div class="live-ctrl">
      ${lc('talkSheet', 'mic', 'Bicara')}
      ${lc('lullaby', 'music', 'Lagu', Sound.lullabyOn())}
      ${lc('liveAudio', s.settings.liveAudio ? 'volume' : 'volumeX', 'Dengar', s.settings.liveAudio)}
      ${lc('snapshot', 'camera', 'Foto')}
      ${lc('toggleRec', 'record', isRec ? 'Stop' : 'Rekam', false, isRec ? 'rec' : '')}
      ${lc('nightToggle', 'moon', 'Malam', night)}
    </div>
    <div class="ai-panel">
      <div class="ai-nums">
        <div><span>${ic('volume', 15)}</span><b data-b="db">-</b><small>dB</small></div>
        <div><span>${ic('move', 15)}</span><b data-b="motion">-</b><small>%</small></div>
        <div><span>${ic('wind', 15)}</span><b data-b="rpm">-</b><small>/mnt</small></div>
      </div>
      <div class="det-grid">
        ${['cry', 'position', 'vomit', 'breath', 'motion', 'wake'].map(t => `<div class="det" data-det="${t}">${ic(Engine.TYPES[t].icon, 16)}<span>${Engine.TYPES[t].short}</span><em></em></div>`).join('')}
      </div>
    </div>`;
  },
  mount() {
    if (Store.s.settings.liveAudio) Sound.roomAudio(true);
    const w = $('#live-wrap');
    if (w) {
      let drag = false, sx = 0, sy = 0, px0 = 0, py0 = 0;
      w.onpointerdown = e => {
        if ((Camera.view.zoom || 1) <= 1 || e.target.closest('button')) return;
        drag = true; sx = e.clientX; sy = e.clientY; px0 = Camera.view.panX || 0; py0 = Camera.view.panY || 0;
      };
      w.onpointermove = e => {
        if (!drag) return;
        Camera.view.panX = Math.max(-1, Math.min(1, px0 - (e.clientX - sx) / 120));
        Camera.view.panY = Math.max(-1, Math.min(1, py0 - (e.clientY - sy) / 80));
      };
      w.onpointerup = w.onpointercancel = w.onpointerleave = () => { drag = false; };
    }
  },
};
const _upd = updateBindings;
updateBindings = function () {
  _upd();
  const L = Engine.live, st = Engine.sim.state;
  $$('[data-ring]').forEach(el => {
    const k = el.dataset.ring;
    const f = k === 'pose' ? 1 : Math.min(1, L[k] / ({ db: 100, motion: 100, rpm: 80 }[k]));
    el.setAttribute('stroke-dasharray', `${(RING_C * f).toFixed(1)} ${RING_C.toFixed(1)}`);
  });
  const hit = { cry: L.db >= 65, motion: L.motion >= 60, position: L.pose === 'Tengkurap', vomit: st === 'vomit' && L.status === 'vomit', breath: L.rpm >= 60 || L.rpm <= 18, wake: L.status === 'awake' };
  $$('[data-det]').forEach(el => {
    const t = el.dataset.det, on = Store.s.settings.detect[t]?.on;
    el.classList.toggle('hit', !!(on && hit[t])); el.classList.toggle('off', !on);
  });
};
Actions.snapshot = () => {
  const a = document.createElement('a');
  a.href = Camera.fullSnapshot(); a.download = `bayi-${Date.now()}.jpg`;
  document.body.appendChild(a); a.click(); a.remove();
  const f = document.createElement('div'); f.className = 'flash'; $('#live-wrap')?.appendChild(f); setTimeout(() => f.remove(), 400);
  toast('Foto disimpan', { icon: 'camera' });
};
Actions.liveAudio = () => {
  const v = !Store.s.settings.liveAudio; Store.setPath('settings.liveAudio', v);
  Sound.roomAudio(v); Sound.setCrying(v && Engine.sim.state === 'cry');
  toast(v ? 'Mendengarkan kamar bayi' : 'Audio kamar mati', { icon: v ? 'volume' : 'volumeX' });
  App.refresh();
};
Actions.nightToggle = () => {
  const cur = Engine.isNight();
  Store.setPath('settings.nightVision', cur ? 'off' : 'on'); Engine.sim.forceNight = null;
  toast(cur ? 'Mode siang' : 'Mode malam (IR)', { icon: cur ? 'sun' : 'moon' });
  App.refresh();
};
Actions.fullscreen = () => { const w = $('#live-wrap'); if (w) w.classList.toggle('fs'); };
Actions.zoomCycle = () => {
  const zs = [1, 1.5, 2, 3];
  const cur = Camera.view.zoom || 1;
  const next = zs[(zs.indexOf(cur) + 1) % zs.length];
  Camera.view.zoom = next;
  if (next === 1) { Camera.view.panX = 0; Camera.view.panY = 0; }
  const lb = $('#zoom-lbl'); if (lb) lb.textContent = `${next}x`;
  toast(next === 1 ? 'Zoom normal (1x)' : `Digital Zoom ${next}x (geser layar untuk arahkan)`, { icon: 'zoomIn' });
};
let pipVideo = null;
Actions.pipToggle = async () => {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }
    if (!pipVideo) {
      pipVideo = document.createElement('video');
      pipVideo.muted = true;
      pipVideo.playsInline = true;
    }
    const stream = Camera.canvas.captureStream(25);
    pipVideo.srcObject = stream;
    await pipVideo.play();
    if (pipVideo.requestPictureInPicture) {
      await pipVideo.requestPictureInPicture();
      toast('Mode Layar Mengambang (PiP) aktif', { icon: 'pip', tone: 'ok' });
    } else {
      toast('Browser ini belum mendukung Picture-in-Picture', { icon: 'info', tone: 'warn' });
    }
  } catch (e) {
    toast('Gagal membuka Picture-in-Picture', { icon: 'alert', tone: 'warn' });
  }
};
Actions.roiSheet = () => {
  const r = Store.s.settings.roi || { on: true, x: 0.10, y: 0.12, w: 0.80, h: 0.76 };
  sheet(`<h3 class="sheet-title">${ic('shield', 20)} Zona Aman Boks (AI Geofence)</h3>
    <p class="muted small">Atur batas area boks bayi pada kamera untuk memfokuskan deteksi posisi & gerakan.</p>
    <div class="card set-row" style="padding:10px 14px;align-items:center">
      <div class="set-main"><b>Tampilkan Garis Zona Aman</b><small>Garis batas biru pada layar kamera</small></div>
      ${toggle('settings.roi.on', r.on)}
    </div>
    <div class="opt-grid">
      <button class="opt ${r.w > 0.75 ? 'on' : ''}" data-act="setRoiPreset" data-p="full">${ic('maximize', 20)}<span>Boks Penuh</span></button>
      <button class="opt ${r.w <= 0.75 && r.w > 0.55 ? 'on' : ''}" data-act="setRoiPreset" data-p="mid">${ic('shield', 20)}<span>Tengah Kasur</span></button>
      <button class="opt ${r.w <= 0.55 ? 'on' : ''}" data-act="setRoiPreset" data-p="tight">${ic('baby', 20)}<span>Area Bayi</span></button>
    </div>`);
};
Actions.setRoiPreset = el => {
  const p = el.dataset.p;
  const presets = {
    full: { on: true, x: 0.08, y: 0.10, w: 0.84, h: 0.80 },
    mid: { on: true, x: 0.16, y: 0.16, w: 0.68, h: 0.68 },
    tight: { on: true, x: 0.24, y: 0.22, w: 0.52, h: 0.56 },
  };
  Store.s.settings.roi = presets[p] || presets.full;
  Camera.view.roi = Store.s.settings.roi;
  Store.save(); closeSheet();
  toast('Zona Aman Boks diperbarui', { icon: 'shield', tone: 'ok' });
  App.refresh();
};
Actions.toggleRec = () => {
  if (recTimer) {
    clearInterval(recTimer); recTimer = null;
    if (mediaRec && mediaRec.state !== 'inactive') {
      mediaRec.stop();
    } else {
      toast('Rekaman video disimpan', { icon: 'video', tone: 'ok' });
    }
    App.refresh();
    return;
  }
  recStart = Date.now();
  recChunks = [];
  try {
    const stream = Camera.canvas.captureStream ? Camera.canvas.captureStream(25) : null;
    if (stream && 'MediaRecorder' in window) {
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      mediaRec = new MediaRecorder(stream, { mimeType: mime });
      mediaRec.ondataavailable = e => { if (e.data && e.data.size > 0) recChunks.push(e.data); };
      mediaRec.onstop = () => {
        const blob = new Blob(recChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `rekaman-bayi-${Date.now()}.webm`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast('Video rekaman (.webm) berhasil diunduh', { icon: 'download', tone: 'ok' });
      };
      mediaRec.start(200);
    }
  } catch (e) { mediaRec = null; }
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    const el = $('#rec-time');
    if (el) el.textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  }, 500);
  toast('Merekam video live… ketuk Stop untuk mengunduh', { icon: 'record', tone: 'bad' });
  App.refresh();
};
Actions.camSourceSheet = () => {
  const isWeb = Camera.view.mode === 'webcam';
  sheet(`<h3 class="sheet-title">${ic('cctv', 20)} Sumber Kamera & Mode Perangkat</h3>
    <div class="list-cards">
      <button class="card pick ${!isWeb ? 'accent' : ''}" data-act="setCamMode" data-m="sim">
        ${ic('sparkles', 24)}
        <span><b>Kamera Simulasi AI (Bawaan)</b><small>Animasi interaktif boks bayi + Panel Simulasi</small></span>
        ${!isWeb ? ic('checkCircle', 20) : ''}
      </button>
      <button class="card pick ${isWeb ? 'accent' : ''}" data-act="setCamMode" data-m="webcam">
        ${ic('camera', 24)}
        <span><b>Kamera & Mikrofon Perangkat Asli</b><small>Gunakan kamera HP/laptop ini + deteksi gerakan & suara nyata</small></span>
        ${isWeb ? ic('checkCircle', 20) : ''}
      </button>
    </div>
    ${isWeb ? `<button class="btn btn-soft btn-lg" data-act="flipCam">${ic('flip', 18)} Balik Kamera (Depan / Belakang)</button>` : ''}
    <p class="fine center">Saat memakai kamera asli, AI menghitung desibel mikrofon & persentase gerakan piksel secara real-time.</p>`);
};
Actions.setCamMode = async el => {
  const m = el.dataset.m;
  closeSheet();
  if (m === 'webcam') {
    toast('Meminta izin kamera & mikrofon…', { icon: 'camera' });
    const ok = await Camera.startWebcam();
    if (ok) {
      toast('Kamera & mikrofon asli aktif!', { icon: 'checkCircle', tone: 'ok' });
      SimPanel.log('Beralih ke Kamera & Mikrofon perangkat asli (WebRTC)');
    } else {
      toast('Izin kamera ditolak atau tidak tersedia, tetap di mode simulasi', { icon: 'alert', tone: 'warn' });
    }
  } else {
    Camera.stopWebcam();
    toast('Kembali ke kamera simulasi AI', { icon: 'sparkles' });
    SimPanel.log('Beralih ke Kamera Simulasi AI');
  }
  App.refresh();
  SimPanel.render();
};
Actions.flipCam = async () => {
  closeSheet();
  const ok = await Camera.flipWebcam();
  if (ok) toast('Kamera dibalik', { icon: 'flip' });
  App.refresh();
};
// matikan audio kamar saat keluar dari live
const _render = App.render.bind(App);
App.render = function () {
  if (this.route.name !== 'live') Sound.roomAudio(false);
  _render();
};

/* ---------------- AKTIVITAS (notifikasi + riwayat + perawatan) ---------------- */
const CARE_TYPES = {
  milk: { label: 'ASI / Susu', icon: 'bottle', tone: 'pri' },
  diaper: { label: 'Ganti Popok', icon: 'droplet', tone: 'info' },
  temp: { label: 'Suhu Tubuh', icon: 'thermo', tone: 'warn' },
  note: { label: 'Catatan / Obat', icon: 'heart', tone: 'ok' },
};
Screens.history = {
  render({ tab = 'events', f = 'all' }) {
    const pending = Store.s.events.filter(e => !e.ack && e.level !== 'info');
    return `<header class="top"><div><div class="hello big">Aktivitas</div></div>
      <div class="top-act">
        <button class="icon-btn soft" data-act="careSheet" aria-label="Tambah perawatan">${ic('plus', 20)}</button>
        <button class="icon-btn soft" data-go="settings" aria-label="Pengaturan">${ic('settings', 20)}</button>
      </div></header>
    <div class="pad-x">
      <div class="seg seg-lg">
        <label><input type="radio" name="ht" ${tab === 'events' ? 'checked' : ''} data-go="history" data-param='{"tab":"events"}'><span>${ic('bell', 15)} Kejadian</span></label>
        <label><input type="radio" name="ht" ${tab === 'care' ? 'checked' : ''} data-go="history" data-param='{"tab":"care"}'><span>${ic('heart', 15)} Rawat</span></label>
        <label><input type="radio" name="ht" ${tab === 'stats' ? 'checked' : ''} data-go="history" data-param='{"tab":"stats"}'><span>${ic('moon', 15)} Tidur</span></label>
        <label><input type="radio" name="ht" ${tab === 'growth' ? 'checked' : ''} data-go="history" data-param='{"tab":"growth"}'><span>${ic('ruler', 15)} Tumbuh</span></label>
      </div>
      ${tab === 'events' ? `
        ${pending.length ? `<button class="pending" data-act="ackAll">${ic('alert', 20)}<b>${pending.length} belum dicek</b><span>Konfirmasi ${ic('check', 16)}</span></button>` : ''}
        ${historyEvents(f)}` : tab === 'care' ? historyCare() : tab === 'growth' ? historyGrowth() : historyStats()}
    </div>`;
  },
  mount() { setTimeout(() => { Store.s.readUpTo = Date.now(); Store.save(); updateBadges(); }, 1500); },
};
Screens.notif = Screens.history;
function historyEvents(f) {
  let list = Store.s.events;
  if (f === 'alert') list = list.filter(e => e.level !== 'info');
  const chips = [['all', 'Semua'], ['alert', 'Penting']];
  return `<div class="chips">${chips.map(([k, l]) => `<button class="chip ${f === k ? 'chip-on' : ''}" data-go="history" data-param='{"tab":"events","f":"${k}"}'>${l}</button>`).join('')}
      <button class="chip" style="margin-left:auto" data-act="exportCsv">${ic('download', 13)} CSV</button>
    </div>
    ${groupByDay(list).map(g => `<div class="day-h">${g.d}</div><div class="card list ev-list">${g.items.map(eventRow).join('')}</div>`).join('') || `<div class="empty">${ic('bell', 40)}<p>Belum ada kejadian</p></div>`}`;
}
function historyCare() {
  const list = Store.s.careLog || [];
  const today = list.filter(c => new Date(c.ts).toDateString() === new Date().toDateString());
  const milkCnt = today.filter(c => c.type === 'milk').length;
  const diaperCnt = today.filter(c => c.type === 'diaper').length;
  const lastTemp = list.find(c => c.type === 'temp')?.detail.split(' ')[0] || '36.6';
  return `
    <div class="sum-grid three">
      <div class="sum"><span>${ic('bottle', 18)}</span><b>${milkCnt}<small>x</small></b><small>susu hari ini</small></div>
      <div class="sum"><span>${ic('droplet', 18)}</span><b>${diaperCnt}<small>x</small></b><small>popok hari ini</small></div>
      <div class="sum"><span>${ic('thermo', 18)}</span><b>${esc(lastTemp)}<small>°C</small></b><small>suhu terakhir</small></div>
    </div>
    <button class="btn btn-pri btn-lg" data-act="careSheet">${ic('plus', 18)} Catat Susu / Popok / Suhu</button>
    ${groupByDay(list).map(g => `<div class="day-h">${g.d}</div><div class="card list ev-list">${g.items.map(c => {
      const T = CARE_TYPES[c.type] || CARE_TYPES.note;
      return `<div class="ev-row">
        <span class="ev-ic tone-${T.tone === 'pri' ? 'info' : T.tone}">${ic(T.icon, 18)}</span>
        <span class="ev-main"><b>${esc(c.label)} · ${esc(c.detail)}</b><small>${fmtTime(c.ts)} · oleh ${esc(c.by || 'Bunda')}</small></span>
        <button class="icon-btn" data-act="delCare" data-id="${c.id}" aria-label="Hapus">${ic('trash', 15)}</button>
      </div>`;
    }).join('')}</div>`).join('') || `<div class="empty">${ic('heart', 40)}<p>Belum ada catatan perawatan</p></div>`}`;
}
Actions.careSheet = () => sheet(`<h3 class="sheet-title">${ic('heart', 20)} Catat Perawatan Bayi</h3>
  <form class="form" id="care-form">
    <div class="opt-grid four" id="care-type-grid">
      ${Object.entries(CARE_TYPES).map(([k, v], i) => `<label class="opt ${i === 0 ? 'on' : ''}"><input type="radio" name="type" value="${k}" ${i === 0 ? 'checked' : ''} class="hidden">${ic(v.icon, 20)}<span>${v.label.split(' ')[0]}</span></label>`).join('')}
    </div>
    <label class="field"><span id="care-dtl-lbl">Jumlah / Keterangan</span><input name="detail" id="care-dtl-in" required placeholder="cth. 120 ml · Habis" value="110 ml · Habis"></label>
    <div class="chips" id="care-presets">
      ${['90 ml · Habis', '120 ml · ASI', 'Pipis (basah)', 'BAB + Pipis', '36.6 °C · Normal', 'Vitamin D'].map(p => `<button type="button" class="chip chip-pri" data-act="carePreset">${p}</button>`).join('')}
    </div>
    <button class="btn btn-pri btn-lg" type="submit">${ic('check', 18)} Simpan Catatan</button>
  </form>`, {
  onMount: el => {
    $$('#care-type-grid label', el).forEach(lb => lb.onclick = () => {
      $$('#care-type-grid label', el).forEach(x => x.classList.toggle('on', x === lb));
      const v = $('input', lb).value;
      const def = { milk: '110 ml · Habis', diaper: 'Pipis (basah)', temp: '36.7 °C · Normal', note: 'Tidur siang tenang' }[v];
      $('#care-dtl-in', el).value = def;
    });
    $('#care-form', el).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const t = f.get('type') || 'milk';
      Store.s.careLog = Store.s.careLog || [];
      Store.s.careLog.unshift({
        id: 'c' + uid(), type: t, label: CARE_TYPES[t].label,
        detail: String(f.get('detail')).trim(), ts: Date.now(), by: (Store.s.user?.name || 'Bunda').split(' ')[0],
      });
      Store.save(); closeSheet();
      toast('Catatan perawatan disimpan', { icon: 'heart', tone: 'ok' });
      if (App.route.name === 'history') App.go('history', { tab: 'care' }, { replace: true });
      else App.refresh();
    };
  },
});
Actions.carePreset = el => { const inp = $('#care-dtl-in'); if (inp) inp.value = el.textContent; };
Actions.delCare = el => {
  Store.s.careLog = (Store.s.careLog || []).filter(c => c.id !== el.dataset.id);
  Store.save(); toast('Catatan dihapus'); App.refresh();
};
function historyStats() {
  const s = Store.s;
  const today = { date: new Date().toISOString().slice(0, 10), hours: +((s.stats.sleptToday + todayBaseSleep()) / 3600).toFixed(1) };
  const days = [...s.sleepLog.slice(-6), today];
  const maxH = 16;
  const avg = (days.reduce((a, d) => a + d.hours, 0) / days.length).toFixed(1);
  const week = s.events.filter(e => e.ts > Date.now() - 7 * 86400000);
  const alerts = week.filter(e => e.level !== 'info');
  const acked = alerts.filter(e => e.ackSec);
  const avgResp = acked.length ? Math.round(acked.reduce((a, e) => a + e.ackSec, 0) / acked.length) : 0;
  const dayName = d => HARI[new Date(d).getDay()].slice(0, 3);
  return `
    <div class="sum-grid three">
      <div class="sum"><span>${ic('moon', 18)}</span><b>${avg}<small>j</small></b><small>rata² tidur</small></div>
      <div class="sum"><span>${ic('alert', 18)}</span><b>${alerts.length}</b><small>alert / 7 hari</small></div>
      <div class="sum"><span>${ic('clock', 18)}</span><b>${avgResp}<small>s</small></b><small>respon</small></div>
    </div>
    <div class="card chart-card">
      <div class="ch-h"><b>Durasi tidur</b><small>garis hijau = 12 jam</small></div>
      <div class="bars">${days.map((d, i) => `<div class="bar-col ${i === days.length - 1 ? 'today' : ''}"><em>${d.hours}</em><div class="bar-track"><i style="height:${Math.min(100, d.hours / maxH * 100)}%"></i><span class="ref" style="bottom:${12 / maxH * 100}%"></span></div><small>${i === days.length - 1 ? 'Ini' : dayName(d.date)}</small></div>`).join('')}</div>
    </div>
    <div class="card">${sleepTimeline()}</div>
    <button class="btn btn-soft btn-lg" data-act="printReport">${ic('download', 18)} Cetak Laporan Dokter Anak (PDF)</button>`;
}
Actions.printReport = () => {
  const s = Store.s, b = s.baby;
  const gList = s.growthLog || [], lastG = gList[gList.length - 1] || {};
  const cList = (s.careLog || []).slice(0, 10);
  const eList = s.events.filter(e => e.level !== 'info').slice(0, 10);
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) { toast('Izinkan pop-up browser untuk mencetak PDF', { icon: 'alert', tone: 'warn' }); return; }
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Kesehatan & Pemantauan Bayi — ${esc(b.name)}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;color:#1a1d3a;padding:32px;line-height:1.5}
    h1{margin:0 0 4px;color:#5B6CF9} h2{font-size:16px;margin:24px 0 8px;border-bottom:2px solid #eef0f6;padding-bottom:4px}
    .meta{color:#6e7397;font-size:13px;margin-bottom:20px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .box{border:1px solid #e8eaf4;border-radius:12px;padding:12px}
    .box b{font-size:20px;display:block} .box small{color:#6e7397;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eef0f6}
    th{background:#f5f6fa;color:#6e7397}
    @media print{button{display:none}}
  </style></head><body>
  <button onclick="window.print()" style="float:right;padding:8px 16px;background:#5B6CF9;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer">Cetak / Simpan PDF</button>
  <h1>Laporan Pemantauan & Tumbuh Kembang Bayi</h1>
  <div class="meta">Dicetak dari AI Baby Monitor · ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
  <div class="grid">
    <div class="box"><small>Nama Bayi</small><b>${esc(b.name)}</b><small>${babyAge(b.birth)}</small></div>
    <div class="box"><small>Berat / Tinggi</small><b>${lastG.weight || '-'} kg / ${lastG.height || '-'} cm</b><small>Lingkar kepala: ${lastG.head || '-'} cm</small></div>
    <div class="box"><small>Rata-rata Tidur</small><b>12.1 jam/hari</b><small>7 hari terakhir</small></div>
    <div class="box"><small>Catatan Kesehatan</small><b>${esc(b.note || 'Normal')}</b><small>Tidak ada keluhan</small></div>
  </div>
  <h2>Riwayat Pengukuran Tumbuh Kembang (KMS)</h2>
  <table><thead><tr><th>Bulan</th><th>Tanggal</th><th>Berat (kg)</th><th>Tinggi (cm)</th><th>Lingkar Kepala (cm)</th><th>Catatan</th></tr></thead>
  <tbody>${gList.map(g => `<tr><td>Bulan ke-${g.month}</td><td>${g.date}</td><td>${g.weight}</td><td>${g.height}</td><td>${g.head}</td><td>${esc(g.note || '-')}</td></tr>`).join('')}</tbody></table>
  <h2>Riwayat Perawatan Terbaru (ASI / Popok / Suhu)</h2>
  <table><thead><tr><th>Waktu</th><th>Kategori</th><th>Detail</th><th>Dicatat Oleh</th></tr></thead>
  <tbody>${cList.map(c => `<tr><td>${fmtDay(c.ts)} ${fmtTime(c.ts)}</td><td>${esc(c.label)}</td><td>${esc(c.detail)}</td><td>${esc(c.by || 'Bunda')}</td></tr>`).join('')}</tbody></table>
  <h2>Log Deteksi Anomali AI</h2>
  <table><thead><tr><th>Waktu</th><th>Kejadian</th><th>Level</th><th>Status</th><th>Waktu Respon</th></tr></thead>
  <tbody>${eList.map(e => `<tr><td>${fmtDay(e.ts)} ${fmtTime(e.ts)}</td><td>${esc(Engine.TYPES[e.type]?.label || e.type)}</td><td>${e.level}</td><td>${e.falseAlarm ? 'Alarm Palsu' : 'Dikonfirmasi'}</td><td>${e.ackSec || 0} dtk</td></tr>`).join('')}</tbody></table>
  <p style="margin-top:28px;font-size:11px;color:#6e7397">*Dokumen ini dihasilkan oleh sistem pemantauan AI Baby Monitor sebagai referensi pendukung konsultasi dokter spesialis anak (DSA).</p>
  </body></html>`);
  w.document.close();
};

const MILESTONES = [
  ['smile', 'Tersenyum sosial', '1–2 bln'],
  ['headUp', 'Mengangkat kepala tegak', '2–3 bln'],
  ['rollOver', 'Tengkurap & berguling', '3–4 bln'],
  ['babble', 'Mengoceh (cooing/babbling)', '4–5 bln'],
  ['sit', 'Duduk dengan bantuan', '5–6 bln'],
  ['crawl', 'Merangkak aktif', '7–9 bln'],
];
function historyGrowth() {
  const list = Store.s.growthLog || [];
  const last = list[list.length - 1] || { weight: 6.4, height: 62.4, head: 40.9 };
  const prev = list[list.length - 2] || last;
  const dw = (last.weight - prev.weight).toFixed(1);
  const maxW = 10;
  const ms = Store.s.milestones || {};
  return `
    <div class="sum-grid three">
      <div class="sum"><span>${ic('baby', 18)}</span><b>${last.weight}<small>kg</small></b><small>${dw >= 0 ? '+' + dw : dw} kg bln ini</small></div>
      <div class="sum"><span>${ic('ruler', 18)}</span><b>${last.height}<small>cm</small></b><small>panjang badan</small></div>
      <div class="sum"><span>${ic('sparkles', 18)}</span><b>${last.head}<small>cm</small></b><small>lingkar kepala</small></div>
    </div>
    <div class="card chart-card">
      <div class="ch-h"><b>Kurva Berat Badan (KMS / WHO)</b><small>garis hijau = median normal</small></div>
      <div class="bars" style="grid-template-columns:repeat(${Math.max(1, list.length)},1fr)">
        ${list.map((g, i) => `<div class="bar-col ${i === list.length - 1 ? 'today' : ''}">
          <em>${g.weight}</em>
          <div class="bar-track"><i style="height:${Math.min(100, (g.weight / maxW) * 100)}%"></i><span class="ref" style="bottom:${(3.3 + i * 0.75) / maxW * 100}%"></span></div>
          <small>Bln ${g.month ?? i}</small>
        </div>`).join('')}
      </div>
    </div>
    <button class="btn btn-pri btn-lg" data-act="growthSheet">${ic('plus', 18)} Catat Berat & Tinggi Baru</button>
    <div class="sec-h"><h3>Milestone Perkembangan</h3></div>
    <div class="card list">
      ${MILESTONES.map(([k, l, age]) => `<button class="li" data-act="toggleMilestone" data-k="${k}">
        <span class="st ${ms[k] ? 'st-ok' : 'st-muted'}">${ic(ms[k] ? 'check' : 'clock', 13)}</span>
        <span><b>${l}</b><small>Usia umum: ${age}</small></span>
        <span class="chip ${ms[k] ? 'chip-ok' : 'chip-muted'}">${ms[k] ? 'Tercapai' : 'Belum'}</span>
      </button>`).join('')}
    </div>`;
}
Actions.toggleMilestone = el => {
  const k = el.dataset.k;
  Store.s.milestones = Store.s.milestones || {};
  Store.s.milestones[k] = !Store.s.milestones[k];
  Store.save();
  toast(Store.s.milestones[k] ? 'Milestone tercapai! 🎉' : 'Status milestone diubah', { icon: 'sparkles', tone: 'ok' });
  App.refresh();
};
Actions.growthSheet = () => {
  const list = Store.s.growthLog || [];
  const last = list[list.length - 1] || { weight: 6.4, height: 62.4, head: 40.9, month: 4 };
  sheet(`<h3 class="sheet-title">${ic('ruler', 20)} Catat Tumbuh Kembang</h3>
    <form class="form" id="growth-form">
      <div class="grid2">
        <label class="field"><span>Berat Badan (kg)</span><input name="weight" type="number" step="0.1" min="1" max="25" value="${(last.weight + 0.3).toFixed(1)}" required></label>
        <label class="field"><span>Panjang / Tinggi (cm)</span><input name="height" type="number" step="0.1" min="30" max="120" value="${(last.height + 1.2).toFixed(1)}" required></label>
      </div>
      <div class="grid2">
        <label class="field"><span>Lingkar Kepala (cm)</span><input name="head" type="number" step="0.1" min="25" max="60" value="${(last.head + 0.4).toFixed(1)}" required></label>
        <label class="field"><span>Usia (Bulan ke-)</span><input name="month" type="number" min="0" max="36" value="${(last.month ?? list.length) + 1}" required></label>
      </div>
      <label class="field"><span>Catatan Imunisasi / Posyandu</span><input name="note" placeholder="cth. Vaksin DPT-HB-Hib 2"></label>
      <button class="btn btn-pri btn-lg" type="submit">${ic('check', 18)} Simpan Pengukuran</button>
    </form>`, {
    onMount: el => {
      $('#growth-form', el).onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target);
        Store.s.growthLog = Store.s.growthLog || [];
        Store.s.growthLog.push({
          id: 'g' + uid(),
          date: new Date().toISOString().slice(0, 10),
          month: +f.get('month'),
          weight: +f.get('weight'),
          height: +f.get('height'),
          head: +f.get('head'),
          note: String(f.get('note') || '').trim(),
        });
        Store.save(); closeSheet();
        toast('Data tumbuh kembang disimpan', { icon: 'ruler', tone: 'ok' });
        App.go('history', { tab: 'growth' }, { replace: true });
      };
    },
  });
};
Actions.ackAll = () => {
  if (Alarm.current) { Alarm.ack(false); return; }
  const now = Date.now();
  Store.s.events.forEach(e => { if (!e.ack && e.level !== 'info') { e.ack = true; e.ackAt = now; e.ackBy = Store.s.user?.name; e.ackSec = Math.round((now - e.ts) / 1000); } });
  Store.save(); toast('Semua dikonfirmasi', { tone: 'ok' }); App.refresh();
};

/* ---------------- DETAIL KEJADIAN ---------------- */
Screens.eventDetail = {
  render({ id }) {
    const e = Store.s.events.find(x => x.id === id);
    if (!e) return topbar('Kejadian') + '<div class="empty"><p>Tidak ditemukan</p></div>';
    const T = Engine.TYPES[e.type];
    const t0 = e.ts, lat = (e.latency || 1) * 1000;
    const steps = [[t0, 'sparkles', 'Terdeteksi AI']];
    if (e.level !== 'info') steps.push([t0 + lat, 'volume', 'Speaker berbunyi']);
    if (e.escalated) steps.push([t0 + Store.s.settings.alarm.escalateSec * 1000, 'users', 'Diteruskan ke keluarga']);
    if (e.ack && e.level !== 'info') steps.push([t0 + (e.ackSec || 0) * 1000, 'check', `Dicek ${esc((e.ackBy || 'Bunda').split(' ')[0])}`]);
    const pend = !e.ack && e.level !== 'info';
    return topbar('') + `<div class="pad">
      <div class="ev-snap">${e.snap ? `<img src="${e.snap}" alt="Cuplikan kamera">` : `<div class="snap-ph">${ic('cctv', 40)}</div>`}
        <span class="chip chip-${levelTone(e.level)} abs">${levelLabel(e.level)}</span></div>
      <div class="ev-title"><span class="ev-ic tone-${levelTone(e.level)}">${ic(T.icon, 22)}</span><div><h2>${T.label}</h2><small>${fmtDay(e.ts)} · ${fmtTime(e.ts)}</small></div></div>
      ${e.metrics ? `<div class="mpills"><span>${ic('volume', 14)}<b>${e.metrics.db}</b> dB</span><span>${ic('move', 14)}<b>${e.metrics.motion}</b>%</span><span>${ic('wind', 14)}<b>${e.metrics.rpm}</b>/mnt</span><span>${ic('activity', 14)}<b>${e.latency}</b>s</span></div>` : ''}
      <div class="steps">${steps.map(([ts, i, l]) => `<div class="stp"><span>${ic(i, 15)}</span><b>${l}</b><small>${fmtTimeS(ts)}</small></div>`).join('')}
        ${pend ? `<div class="stp pend"><span>${ic('clock', 15)}</span><b>Menunggu konfirmasi</b></div>` : ''}</div>
      ${pend ? `<button class="btn btn-pri btn-lg" data-act="ack">${ic('check', 20)} Sudah saya cek</button>` : ''}
      <div class="a-round light">
        <button data-go="live" data-reset="1"><span>${ic('video', 20)}</span>Live</button>
        ${e.level !== 'info' ? `<button data-act="toggleFalse" data-id="${e.id}" class="${e.falseAlarm ? 'on' : ''}"><span>${ic('flag', 20)}</span>${e.falseAlarm ? 'Palsu ✓' : 'Palsu?'}</button>` : ''}
        <button data-act="delEvent" data-id="${e.id}" class="danger"><span>${ic('trash', 20)}</span>Hapus</button>
      </div>
    </div>`;
  },
};
Actions.toggleFalse = el => { const e = Store.s.events.find(x => x.id === el.dataset.id); if (e) { e.falseAlarm = !e.falseAlarm; e.ack = true; Store.save(); toast(e.falseAlarm ? 'Ditandai alarm palsu' : 'Tanda dihapus', { icon: 'flag' }); App.refresh(); } };
Actions.delEvent = async el => { if (await confirmBox('Hapus kejadian?', 'Data & cuplikan dihapus permanen.', 'Hapus', true)) { Store.s.events = Store.s.events.filter(x => x.id !== el.dataset.id); Store.save(); App.back(); toast('Dihapus'); } };

/* ---------------- PROFIL ---------------- */
Screens.profile = {
  render() {
    const s = Store.s, P = PLANS[s.plan] || PLANS.app;
    if (isGuest()) return `${topbar('Profil')}
    <div class="pad-x">
      <div class="card guest-card"><div class="lock-hero">${ic('user', 28)}</div><b>Kamu belum masuk</b><small class="muted">Masuk untuk menyimpan riwayat, mengundang keluarga, dan menghubungkan kamera.</small>
        <button class="btn btn-pri btn-lg" data-go="auth">Masuk</button><button class="btn btn-soft btn-lg" data-go="auth" data-param='{"mode":"register"}'>Daftar gratis</button></div>
      <div class="card list">
        <button class="li" data-go="help">${ic('help', 20)}<span><b>Bantuan</b></span>${ic('chevR', 18)}</button>
        <button class="li" data-go="help" data-param='{"about":1}'>${ic('info', 20)}<span><b>Tentang</b><small>v1.0 prototipe</small></span>${ic('chevR', 18)}</button>
      </div>
    </div>`;
    const item = (icon, label, go, sub = '', param = '') => `<button class="li" ${go.startsWith('act:') ? `data-act="${go.slice(4)}"` : `data-go="${go}"`} ${param ? `data-param='${param}'` : ''}>${ic(icon, 20)}<span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>${ic('chevR', 18)}</button>`;
    const tile = (icon, label, go, param = '') => `<button class="mt" data-go="${go}" ${param ? `data-param='${param}'` : ''}><span>${ic(icon, 22)}</span><small>${label}</small></button>`;
    return `${topbar('Profil')}
    <div class="pad-x">
      <div class="card prof">
        <span class="avatar xl">${initials(s.user?.name)}</span>
        <div><b>${esc(s.user?.name || 'Pengguna')}</b><small>${esc(s.user?.email || '')}</small><span class="chip chip-pri">${ic(s.plan === 'bundle' ? 'package' : 'phone', 13)} ${P.name}</span></div>
        <button class="icon-btn soft" data-act="editUser" aria-label="Ubah profil">${ic('edit', 18)}</button>
      </div>
      <div class="card baby-mini" data-go="baby">
        <span class="baby-av sm">${babyAvatarHtml('sm')}</span>
        <div><b>${esc(s.baby.name)}</b><small>${babyAge(s.baby.birth)}</small></div>${ic('chevR', 18)}
      </div>
      <div class="mtiles two">
        ${tile('settings', 'Pengaturan', 'settings')}
        ${tile('cctv', 'Perangkat', 'devices')}
        ${tile('users', 'Keluarga', 'family')}
        ${tile('package', 'Paket', 'subscription')}
      </div>
      <div class="links">
        <button data-go="security">${ic('lock', 16)} Keamanan</button>
        <button data-go="help">${ic('help', 16)} Bantuan</button>
        <button data-act="logout" class="danger">${ic('logout', 16)} Keluar</button>
      </div>
      <p class="fine center" data-go="help" data-param='{"about":1}'>AI Baby Monitor v1.0</p>
    </div>`;
  },
};
Actions.editUser = () => sheet(`<h3 class="sheet-title">Ubah Profil</h3><form class="form" id="user-form">
  <label class="field"><span>Nama</span><input name="name" value="${esc(Store.s.user?.name)}" required></label>
  <label class="field"><span>Email</span><input name="email" type="email" value="${esc(Store.s.user?.email)}" required></label>
  <label class="field"><span>No. HP</span><input name="phone" value="${esc(Store.s.user?.phone)}"></label>
  <button class="btn btn-pri btn-lg">Simpan</button></form>`, {
  onMount: el => { $('#user-form', el).onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); Object.assign(Store.s.user, { name: f.get('name'), email: f.get('email'), phone: f.get('phone') }); Store.save(); closeSheet(); toast('Profil diperbarui'); App.refresh(); }; },
});
Actions.logout = async () => { if (await confirmBox('Keluar?', 'Kamu akan kembali ke mode demo.', 'Keluar', true)) { Alarm.stop(); Store.s.user = null; Store.save(); App.go('home', {}, { reset: true }); } };
Actions.resetDemo = async () => { if (await confirmBox('Reset data demo?', 'Semua pengaturan, perangkat dan riwayat akan dihapus dan aplikasi mulai dari awal.', 'Reset', true)) { Alarm.stop(); Engine.setAutoDemo(false); Engine.setBaby('sleep'); Store.reset(); App.go('splash', {}, { reset: true }); SimPanel.render(); } };

Screens.baby = { render: () => topbar('Profil Bayi') + `<div class="pad">${babyForm(false)}</div>`, mount: () => bindBabyForm(false) };

/* ---------------- PENGATURAN ---------------- */
const SENS = ['rendah', 'sedang', 'tinggi'];
function chipT(path, icon, label) {
  const on = !!Store.getPath(path);
  return `<button class="ct ${on ? 'on' : ''}" data-act="chipToggle" data-path="${path}" aria-pressed="${on}">${ic(icon, 18)}<span>${label}</span></button>`;
}
function optGrid(path, opts, val) {
  return `<div class="opt-grid">${opts.map(([v, i, l]) => `<button class="opt ${String(val) === String(v) ? 'on' : ''}" data-act="setOpt" data-path="${path}" data-v="${v}">${ic(i, 22)}<span>${l}</span></button>`).join('')}</div>`;
}
Screens.settings = {
  render() {
    const S = Store.s.settings, D = S.detect;
    const DET = [['cry', 'Tangisan'], ['position', 'Tengkurap'], ['vomit', 'Muntah'], ['breath', 'Napas'], ['motion', 'Gerakan'], ['wake', 'Bangun']];
    const tile = ([t, l]) => {
      const lv = SENS.indexOf(D[t].sens) + 1, tone = levelTone(Engine.TYPES[t].level);
      return `<div class="dt ${D[t].on ? 'on' : ''} t-${tone}">
        <button class="dt-main" data-act="detToggle" data-t="${t}" aria-pressed="${D[t].on}"><span class="dt-ic">${ic(Engine.TYPES[t].icon, 22)}</span><b>${l}</b></button>
        <div class="dt-sens">${[1, 2, 3].map(n => `<button data-act="detSens" data-t="${t}" data-v="${n}" class="${D[t].on && lv >= n ? 'f' : ''}" aria-label="Sensitivitas ${SENS[n - 1]}"></button>`).join('')}</div>
      </div>`;
    };
    return topbar('Pengaturan', { back: App.stack.length > 0 }) + `<div class="pad">
      <div class="grp-h">${ic('sparkles', 15)}<b>Deteksi AI</b><small>garis = sensitivitas</small></div>
      <div class="dt-grid">${DET.map(tile).join('')}</div>

      <div class="grp-h">${ic('volume', 15)}<b>Alarm</b></div>
      ${optGrid('settings.alarm.sound', [['siren', 'alert', 'Sirene'], ['chime', 'bell', 'Lonceng'], ['voice', 'mic', 'Suara']], S.alarm.sound)}
      <div class="card vol">${ic('volumeX', 18)}<input type="range" min="10" max="100" step="5" value="${S.alarm.volume}" data-set="settings.alarm.volume" data-num="1" data-out="#vol-out" data-unit="%" aria-label="Volume">${ic('volume', 18)}<b id="vol-out">${S.alarm.volume}%</b></div>
      <div class="ct-grid">
        ${chipT('settings.alarm.tts', 'mic', 'Suara')}
        ${chipT('settings.push', 'bell', 'Push')}
        ${chipT('settings.quiet.on', 'moon', 'Tenang')}
      </div>
      ${S.quiet.on ? `<div class="card times">${ic('moon', 18)}<input type="time" value="${S.quiet.from}" data-set="settings.quiet.from" aria-label="Mulai"><span>-</span><input type="time" value="${S.quiet.to}" data-set="settings.quiet.to" aria-label="Selesai"></div>` : ''}
      <button class="btn btn-soft" data-act="testSpeaker">${ic('play', 18)} Tes alarm</button>

      <div class="grp-h">${ic('users', 15)}<b>Teruskan ke keluarga setelah</b></div>
      ${seg('settings.alarm.escalateSec', [[15, '15s'], [30, '30s'], [60, '60s'], [0, 'Off']], S.alarm.escalateSec)}

      <div class="grp-h">${ic('eye', 15)}<b>Tampilan</b></div>
      ${optGrid('settings.theme', [['auto', 'sparkles', 'Auto'], ['light', 'sun', 'Terang'], ['dark', 'moon', 'Gelap']], S.theme || 'auto')}

      <div class="grp-h">${ic('cctv', 15)}<b>Kamera</b></div>
      ${optGrid('settings.nightVision', [['auto', 'sparkles', 'Auto'], ['on', 'moon', 'Malam'], ['off', 'sun', 'Siang']], S.nightVision)}
      ${disclaimer()}
    </div>`;
  },
};
Actions.detToggle = el => { const d = Store.s.settings.detect[el.dataset.t]; d.on = !d.on; Store.save(); App.refresh(); };
Actions.detSens = el => { const d = Store.s.settings.detect[el.dataset.t]; d.on = true; d.sens = SENS[+el.dataset.v - 1]; Store.save(); App.refresh(); };
Actions.setOpt = el => { const v = el.dataset.v; Store.setPath(el.dataset.path, isNaN(+v) ? v : +v); App.refresh(); };
Actions.chipToggle = el => {
  const p = el.dataset.path, v = !Store.getPath(p);
  Store.setPath(p, v);
  if (p === 'settings.push' && v) Actions.pushPerm({ checked: true });
  App.refresh();
};
Actions.rerender = () => App.refresh();
Actions.pushPerm = el => {
  if (el.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(p => toast(p === 'granted' ? 'Notifikasi diizinkan' : 'Izin notifikasi ditolak browser', { icon: 'bell' }));
};

/* ---------------- PERANGKAT ---------------- */
Screens.devices = {
  render() {
    const s = Store.s;
    const cam = c => `<div class="dcard" data-act="devInfo" data-id="${c.id}" role="button">
        <div class="dcard-top"><span class="dcard-ic">${ic('cctv', 26)}</span><i class="dot ${Engine.sim.camOnline ? 'ok' : 'bad'}"></i></div>
        <b>${esc(c.name)}</b><small>${esc(c.brand)}</small>
        <div class="dcard-act">
          <button data-act="restartDev" aria-label="Mulai ulang">${ic('power', 16)}</button>
          <button data-act="delCam" data-id="${c.id}" class="danger" aria-label="Hapus">${ic('trash', 16)}</button>
        </div></div>`;
    const spk = sp => `<div class="dcard speaker-chip">
        <div class="dcard-top"><span class="dcard-ic">${ic(SPEAKER_TYPES[sp.type].icon, 26)}</span><i class="dot ok"></i></div>
        <b>${esc(sp.name)}</b>
        <div class="mini-vol">${ic('volume', 14)}<input type="range" min="10" max="100" step="5" value="${sp.volume}" data-spk="${sp.id}" aria-label="Volume"></div>
        <div class="dcard-act">
          <button data-act="testSpeaker" aria-label="Tes">${ic('play', 16)}</button>
          <button data-act="delSpk" data-id="${sp.id}" class="danger" aria-label="Hapus">${ic('trash', 16)}</button>
        </div></div>`;
    const add = (step, label) => `<button class="dcard add" data-go="setup" data-param='{"step":"${step}","add":true}'><span class="dcard-ic">${ic('plus', 26)}</span><b>${label}</b></button>`;
    return topbar('Perangkat') + `<div class="pad">
      <div class="grp-h">${ic('cctv', 15)}<b>Kamera</b></div>
      <div class="dgrid">${s.cameras.map(cam).join('')}${add('camera', 'Kamera')}</div>
      <div class="grp-h">${ic('volume', 15)}<b>Speaker alarm</b></div>
      <div class="dgrid">${s.speakers.map(spk).join('')}${add('speaker', 'Speaker')}</div>
      <div class="net-card ${Engine.sim.internet ? '' : 'warn'}">
        <span>${ic(Engine.sim.internet ? 'cloud' : 'router', 20)}</span>
        <b>${Engine.sim.internet ? 'Cloud AI terhubung' : 'Gateway lokal aktif'}</b><i class="dot ${Engine.sim.internet ? 'ok' : 'warn'}"></i>
      </div>
      <div class="grp-h">${ic('radio', 15)}<b>Mode 2 Perangkat & Kamera Asli</b></div>
      <div class="card list">
        <button class="li" data-act="camSourceSheet">${ic('camera', 20)}<span><b>Gunakan Kamera Perangkat Ini</b><small>${Camera.view.mode === 'webcam' ? 'Aktif — kamera & mikrofon real-time' : 'Beralih dari simulasi ke kamera asli'}</small></span>${ic('chevR', 18)}</button>
        <button class="li" data-act="syncSheet">${ic('link', 20)}<span><b>Sinkronisasi 2 Tab / Perangkat</b><small>Kode ruang: ${esc(s.settings.roomCode || 'AIBM-88')} · Broadcast & Cloud API</small></span>${ic('chevR', 18)}</button>
      </div>
    </div>`;
  },
};
document.addEventListener('change', e => {
  const el = e.target.closest('[data-spk]'); if (!el) return;
  const sp = Store.s.speakers.find(x => x.id === el.dataset.spk); if (sp) { sp.volume = +el.value; Store.save(); }
});
Actions.devInfo = (el, e) => {
  if (e.target.closest('.dcard-act')) return;
  const c = Store.s.cameras.find(x => x.id === el.dataset.id); if (!c) return;
  const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  sheet(`<h3 class="sheet-title">${ic('cctv', 20)} ${esc(c.name)}</h3>
    <div class="card">
      ${kv('Merek', esc(c.brand))}
      ${kv('Koneksi', c.type === 'rtsp' ? 'RTSP' : 'Cloud')}
      ${kv('Resolusi', esc(c.res))}
      ${c.url ? kv('URL', `<span class="mono">${esc(c.url)}</span>`) : kv('No. seri', `<span class="mono">${esc(c.sn || '-')}</span>`)}
    </div>`);
};
Actions.restartDev = () => { toast('Kamera dimulai ulang…', { icon: 'power' }); Engine.setCamera(false); setTimeout(() => { Engine.setCamera(true); toast('Kamera online', { icon: 'cctv', tone: 'ok' }); if (App.route.name === 'devices') App.refresh(); }, 3500); };
Actions.delCam = async el => { if (await confirmBox('Hapus kamera?', 'Kamera diputus dari akun ini.', 'Hapus', true)) { Store.s.cameras = Store.s.cameras.filter(c => c.id !== el.dataset.id); Store.save(); App.refresh(); } };
Actions.delSpk = async el => { if (await confirmBox('Hapus speaker?', 'Alarm tidak lagi dibunyikan di speaker ini.', 'Hapus', true)) { Store.s.speakers = Store.s.speakers.filter(c => c.id !== el.dataset.id); Store.save(); SpeakerUI.idle(); App.refresh(); } };

/* ---------------- KELUARGA ---------------- */
Screens.family = {
  render() {
    const s = Store.s;
    const first = n => esc(String(n || '').split(' ')[0]);
    return topbar('Keluarga') + `<div class="pad">
      <div class="fam-grid">
        <div class="fcard me"><span class="avatar xl">${initials(s.user?.name)}</span><b>${first(s.user?.name)}</b><small>Admin</small></div>
        ${s.family.map(f => `<div class="fcard ${f.notify ? '' : 'muted-card'}">
          <span class="avatar xl alt">${initials(f.name)}</span><b>${first(f.name)}</b><small>${f.pending ? 'Diundang' : esc(f.role)}</small>
          <button class="fbell ${f.notify ? 'on' : ''}" data-act="famBell" data-id="${f.id}" aria-label="Notifikasi ${first(f.name)}">${ic(f.notify ? 'bell' : 'volumeX', 15)}</button>
        </div>`).join('')}
        <button class="fcard add" data-act="famInvite"><span class="avatar xl">${ic('plus', 26)}</span><b>Undang</b></button>
      </div>
      <div class="esc-card"><div class="esc-h">${ic('users', 18)}<span>Alarm diteruskan setelah</span></div>${seg('settings.alarm.escalateSec', [[15, '15s'], [30, '30s'], [60, '60s'], [0, 'Off']], s.settings.alarm.escalateSec)}</div>
    </div>`;
  },
};
Actions.famBell = el => { const f = Store.s.family.find(x => x.id === el.dataset.id); if (f) { f.notify = !f.notify; Store.save(); App.refresh(); } };
Actions.famInvite = () => sheet(`<h3 class="sheet-title">${ic('users', 20)} Undang anggota</h3>
  <form class="form" id="fam-form">
    <label class="field"><span>Nama</span><input name="name" required placeholder="Mbak Asih"></label>
    <label class="field"><span>Email / WhatsApp</span><input name="email" required placeholder="nama@email.com"></label>
    <div class="seg"><label><input type="radio" name="role" value="Orang Tua" checked><span>Orang tua</span></label><label><input type="radio" name="role" value="Pengasuh"><span>Pengasuh</span></label><label><input type="radio" name="role" value="Lihat saja"><span>Lihat</span></label></div>
    <button class="btn btn-pri btn-lg">${ic('mail', 18)} Kirim</button>
  </form>`, {
  onMount: el => {
    $('#fam-form', el).onsubmit = e => {
      e.preventDefault(); const f = new FormData(e.target);
      Store.s.family.push({ id: uid(), name: f.get('name'), email: f.get('email'), role: f.get('role'), notify: true, pending: true });
      Store.save(); closeSheet(); toast(`Undangan dikirim ke ${f.get('name')}`, { icon: 'mail' }); App.refresh();
    };
  },
});

/* ---------------- LANGGANAN ---------------- */
Screens.subscription = {
  render() {
    const s = Store.s, P = PLANS[s.plan] || PLANS.app;
    const end = new Date(Date.now() + (s.plan === 'bundle' ? 300 : 12) * 86400000);
    return topbar('Paket & Langganan') + `<div class="pad">
      <div class="card plan-cur">
        <span class="plan-ic">${ic(s.plan === 'bundle' ? 'package' : 'phone', 26)}</span>
        <div><small>Paket aktif</small><b>${P.name}</b><small>${s.plan === 'bundle' ? 'Premium aktif hingga' : 'Masa uji coba hingga'} ${end.getDate()} ${BULAN[end.getMonth()]} ${end.getFullYear()}</small></div>
      </div>
      <div class="card"><ul class="feat">${P.feats.map(f => `<li>${ic('check', 16)}${f}</li>`).join('')}</ul></div>
      ${s.plan === 'app' ? `<div class="card upsell">
        <b>${ic('package', 18)} Upgrade ke Paket Lengkap</b>
        <p class="muted">Dapatkan kamera AI & speaker alarm yang sudah diprogram — tanpa repot setting RTSP, plus gateway lokal bawaan.</p>
        <button class="btn btn-pri" data-act="orderKit">Pesan Perangkat · ${rupiah(PLANS.bundle.price)}</button>
      </div>` : `<div class="card"><b>Perpanjangan Premium</b><p class="muted">Setelah 12 bulan: ${rupiah(390000)}/tahun. Perangkat tetap bisa dipakai untuk live view tanpa langganan.</p></div>`}
      <button class="btn btn-ghost" data-go="plan" data-param='{"from":"sub"}'>Ganti paket</button>
      <div class="sec-h"><h3>Riwayat pembayaran</h3></div>
      <div class="card list"><div class="li">${ic('calendar', 20)}<span><b>${s.plan === 'bundle' ? 'Paket Lengkap' : 'Uji coba 14 hari'}</b><small>${new Date().getDate()} ${BULAN[new Date().getMonth()]} ${new Date().getFullYear()}</small></span><b>${s.plan === 'bundle' ? rupiah(PLANS.bundle.price) : 'Rp 0'}</b></div></div>
    </div>`;
  },
};
Actions.orderKit = () => sheet(`<h3 class="sheet-title">Pesan Paket Lengkap</h3>
  <div class="kit">${ic('cctv', 36)}<span>+</span>${ic('speaker', 36)}</div>
  <div class="kv"><span>Kamera AI 2K + Speaker Alarm</span><b>${rupiah(PLANS.bundle.price)}</b></div>
  <div class="kv"><span>Ongkir</span><b>Gratis</b></div>
  <div class="kv"><span>Premium 12 bulan</span><b>Termasuk</b></div>
  <div class="field"><span>Metode pembayaran</span><div class="seg"><label><input type="radio" name="pm" checked><span>QRIS</span></label><label><input type="radio" name="pm"><span>Transfer</span></label><label><input type="radio" name="pm"><span>Kartu</span></label></div></div>
  <button class="btn btn-pri btn-lg" data-act="payKit">Bayar Sekarang (simulasi)</button>`);
Actions.payKit = () => { closeSheet(); Store.s.plan = 'bundle'; Store.save(); toast('Pesanan dibuat! Perangkat dikirim 2–3 hari kerja', { icon: 'package', tone: 'ok', ms: 3500 }); App.refresh(); };

/* ---------------- KEAMANAN ---------------- */
Screens.security = {
  render() {
    const S = Store.s.settings;
    return topbar('Keamanan & Privasi') + `<div class="pad">
      <div class="card sec-hero">${ic('shield', 30)}<div><b>Video Anda terlindungi</b><small>Enkripsi end-to-end (AES-256) · Koneksi TLS 1.3 · Server di Singapura</small></div></div>
      <div class="card">
        <div class="set-row"><div class="set-main"><b>Verifikasi 2 langkah</b><small>Kode OTP via WhatsApp saat login di HP baru</small></div>${toggle('settings.twoFA', S.twoFA)}</div>
        <div class="set-row"><div class="set-main"><b>Kunci aplikasi (PIN / Face ID)</b><small>Minta PIN (${esc(S.pinCode || '1234')}) saat membuka aplikasi</small></div>${toggle('settings.pin', S.pin, 'rerender')}</div>
        ${S.pin ? `<div class="set-row"><div class="set-main"><b>Kode PIN 4 Digit</b><small>Ketuk untuk mengubah atau menguji kunci</small></div><div class="btn-row"><button class="btn btn-sm btn-soft" data-act="changePin">${ic('key', 14)} Ubah PIN</button><button class="btn btn-sm btn-pri" data-act="lockNow">${ic('lock', 14)} Kunci</button></div></div>` : ''}
        <div class="set-row"><div class="set-main"><b>Enkripsi end-to-end</b><small>Selalu aktif untuk semua stream</small></div><span class="chip chip-ok">Aktif</span></div>
      </div>
      <div class="sec-h"><h3>Sesi aktif</h3></div>
      <div class="card list">
        <div class="li">${ic('phone', 20)}<span><b>Perangkat ini</b><small>Aktif sekarang</small></span><span class="chip chip-ok">Saat ini</span></div>
        <div class="li">${ic('phone', 20)}<span><b>iPhone 13 — Budi</b><small>Jakarta · 2 jam lalu</small></span><button class="btn btn-sm btn-soft" data-act="revoke">Keluarkan</button></div>
      </div>
      <div class="sec-h"><h3>Data & privasi</h3></div>
      <div class="card list">
        <button class="li" data-act="exportCsv">${ic('download', 20)}<span><b>Unduh data saya</b><small>Riwayat kejadian & perawatan (CSV)</small></span>${ic('chevR', 18)}</button>
        <button class="li danger" data-act="wipeRec">${ic('trash', 20)}<span><b>Hapus semua rekaman & cuplikan</b></span>${ic('chevR', 18)}</button>
      </div>
    </div>`;
  },
};
Actions.revoke = el => { el.closest('.li').remove(); toast('Sesi dikeluarkan'); };
Actions.wipeRec = async () => { if (await confirmBox('Hapus semua rekaman?', 'Semua cuplikan kejadian akan dihapus permanen dari cloud dan perangkat ini.', 'Hapus', true)) { Store.s.events.forEach(e => delete e.snap); Store.save(); toast('Semua rekaman dihapus'); } };
Actions.lockNow = () => {
  Store.s.settings.pin = true; Store.save();
  pinUnlocked = false; pinBuf = '';
  App.go('pinLock', {}, { reset: true });
};
Actions.changePin = () => sheet(`<h3 class="sheet-title">${ic('key', 20)} Ubah Kode PIN</h3>
  <form class="form" id="pin-form">
    <label class="field"><span>PIN 4 Digit Baru</span><input name="pin" pattern="^\\d{4}$" maxlength="4" inputmode="numeric" value="${esc(Store.s.settings.pinCode || '1234')}" required></label>
    <button class="btn btn-pri btn-lg" type="submit">Simpan PIN</button>
  </form>`, {
  onMount: el => {
    $('#pin-form', el).onsubmit = e => {
      e.preventDefault();
      const p = new FormData(e.target).get('pin');
      Store.s.settings.pinCode = p; Store.s.settings.pin = true; Store.save();
      closeSheet(); toast('Kode PIN berhasil diperbarui', { icon: 'lock', tone: 'ok' }); App.refresh();
    };
  },
});
Actions.exportCsv = () => {
  const rows = [['Waktu', 'Kategori', 'Jenis', 'Level', 'Dikonfirmasi Oleh', 'Respon (dtk)', 'Alarm Palsu', 'Latensi (dtk)', 'Suara (dB)', 'Gerak (%)', 'Napas (/mnt)']];
  Store.s.events.forEach(e => {
    const T = Engine.TYPES[e.type] || { label: e.type };
    rows.push([
      new Date(e.ts).toISOString(), 'Deteksi AI', T.label, e.level,
      e.ackBy || '-', e.ackSec || 0, e.falseAlarm ? 'Ya' : 'Tidak', e.latency || '',
      e.metrics?.db ?? '', e.metrics?.motion ?? '', e.metrics?.rpm ?? '',
    ]);
  });
  (Store.s.careLog || []).forEach(c => {
    rows.push([new Date(c.ts).toISOString(), 'Perawatan', c.label, c.detail, c.by || 'Bunda', '', '', '', '', '', '']);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ai-baby-monitor-${Store.s.baby.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  toast('Data CSV berhasil diunduh', { icon: 'download', tone: 'ok' });
};

/* ---------------- BANTUAN / TENTANG ---------------- */
Screens.help = {
  render({ about }) {
    if (about) return topbar('Tentang') + `<div class="pad center-col">
      <div class="about-logo">${logo(72)}</div><h2>AI Baby Monitor</h2><p class="muted">Tidur Nyenyak, Bayi Lebih Aman</p><span class="chip chip-muted">Versi 1.0.0 · Prototipe</span>
      <div class="card left"><p>Sistem pemantauan bayi berbasis kecerdasan buatan yang menghubungkan kamera CCTV/IP, aplikasi mobile, dan speaker alarm untuk memberi peringatan dini saat ada anomali.</p></div>
      ${disclaimer()}
      <p class="tiny muted">© ${new Date().getFullYear()} AI Baby Monitor. Semua hak dilindungi.</p></div>`;
    const faq = [
      ['Apakah CCTV saya kompatibel?', 'Kamera yang mendukung RTSP atau ONVIF umumnya kompatibel — misalnya TP-Link Tapo C200/C220, Reolink E1 Pro, Ezviz, Imou, Hikvision. Aktifkan “Akun Kamera” di aplikasi bawaan kamera untuk mendapat username & password RTSP.'],
      ['Bagaimana kalau internet mati?', 'Gateway lokal (bawaan kamera paket atau aplikasi di HP) tetap menjalankan deteksi dasar dan membunyikan speaker. Notifikasi ke HP di luar rumah akan tertunda sampai internet kembali.'],
      ['Seberapa cepat alarm berbunyi?', 'Target sistem: kurang dari 5 detik sejak anomali terdeteksi. Waktu respon aktual terlihat di detail setiap kejadian.'],
      ['Apakah AI bisa salah?', 'Bisa. Pencahayaan, posisi kamera, dan selimut bisa memengaruhi akurasi. Tandai “alarm palsu” agar model AI terus belajar. AI ini bukan alat medis.'],
      ['Siapa yang bisa melihat video bayi saya?', 'Hanya akun Anda dan anggota keluarga yang Anda undang. Video dienkripsi end-to-end.'],
    ];
    return topbar('Bantuan & Panduan') + `<div class="pad">
      <div class="card list">${faq.map(([q, a]) => `<details class="faq"><summary>${q}${ic('chevD', 18)}</summary><p>${a}</p></details>`).join('')}</div>
      <div class="sec-h"><h3>Butuh bantuan?</h3></div>
      <div class="card list">
        <button class="li" data-act="contact">${ic('phone', 20)}<span><b>WhatsApp CS</b><small>Setiap hari 08.00–21.00</small></span>${ic('chevR', 18)}</button>
        <button class="li" data-act="contact">${ic('mail', 20)}<span><b>Email</b><small>support@aibabymonitor.id</small></span>${ic('chevR', 18)}</button>
      </div>
      ${disclaimer()}
    </div>`;
  },
};
Actions.contact = () => toast('Di aplikasi asli, ini membuka WhatsApp/Email', { icon: 'info' });

/* ---------------- SINKRONISASI 2 PERANGKAT & BACKEND API ---------------- */
const Sync = (() => {
  let bc = null, txTimer = null, apiOnline = false;
  try { bc = new BroadcastChannel('aibm_sync_channel'); } catch (e) { /* */ }

  if (bc) {
    bc.onmessage = e => {
      const d = e.data;
      if (!d || d.room !== Store.s.settings.roomCode) return;
      if (d.type === 'frame' && Camera.view.mode === 'remote') {
        Camera.setRemoteFrame(d.frame);
        Object.assign(Engine.live, d.live);
        Engine.sim.state = d.state;
        updateBindings();
      } else if (d.type === 'alert') {
        Store.addEvent(d.ev);
        Alarm.handle(d.ev);
      } else if (d.type === 'ack') {
        Alarm.stop();
        App.refresh();
      }
    };
  }

  function startBroadcast() {
    clearInterval(txTimer);
    txTimer = setInterval(() => {
      if (bc && Camera.view.mode !== 'remote') {
        bc.postMessage({
          room: Store.s.settings.roomCode,
          type: 'frame',
          frame: Camera.snapshot(320, .55),
          live: Engine.live,
          state: Engine.sim.state,
        });
      }
      // Jika backend URL disetel, kirim heartbeat / frame
      const url = Store.s.settings.backendUrl;
      if (url && Engine.sim.internet && Camera.view.mode !== 'remote') {
        fetch(`${url.replace(/\/$/, '')}/ingest/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Ingest-Token': Store.s.settings.ingestToken || '' },
          body: JSON.stringify({
            camera_id: Store.s.cameras[0]?.id || 'cam-01',
            status: Engine.sim.state,
            db: Math.round(Engine.live.db),
            motion: Math.round(Engine.live.motion),
            rpm: Math.round(Engine.live.rpm),
          }),
        }).then(r => { apiOnline = r.ok; }).catch(() => { apiOnline = false; });
      }
    }, 1500);
  }
  startBroadcast();

  Engine.on('alert', ev => {
    if (bc) bc.postMessage({ room: Store.s.settings.roomCode, type: 'alert', ev });
    const url = Store.s.settings.backendUrl;
    if (url && Engine.sim.internet) {
      fetch(`${url.replace(/\/$/, '')}/v1/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ingest-Token': Store.s.settings.ingestToken || '' },
        body: JSON.stringify({ type: ev.type, level: ev.level, latency: ev.latency, metrics: ev.metrics }),
      }).catch(() => {});
    }
  });

  return { get apiOnline() { return apiOnline; } };
})();

Actions.syncSheet = () => {
  const s = Store.s.settings;
  const isRemote = Camera.view.mode === 'remote';
  sheet(`<h3 class="sheet-title">${ic('link', 20)} Sinkronisasi & Server Backend</h3>
    <p class="muted small">Gunakan 2 tab/perangkat sebagai <b>Unit Kamera Bayi</b> dan <b>Unit Orang Tua</b>, atau hubungkan ke server FastAPI sesuai PRD.</p>
    <div class="seg">
      <label><input type="radio" name="roleMode" ${!isRemote ? 'checked' : ''} data-act="setRoleMode" data-m="sender"><span>Unit Kamera / Utama</span></label>
      <label><input type="radio" name="roleMode" ${isRemote ? 'checked' : ''} data-act="setRoleMode" data-m="receiver"><span>Penerima (Orang Tua)</span></label>
    </div>
    <form class="form" id="sync-form">
      <label class="field"><span>Kode Ruang Sinkronisasi</span><input name="room" value="${esc(s.roomCode || 'AIBM-88')}" required></label>
      <label class="field"><span>URL Backend FastAPI (opsional)</span><input name="url" placeholder="http://127.0.0.1:8000" value="${esc(s.backendUrl || '')}"></label>
      <label class="field"><span>Token Ingest (.env)</span><input name="token" value="${esc(s.ingestToken || 'aibm-secret-token-2026')}"></label>
      <div class="btn-row">
        <button type="button" class="btn btn-soft" data-act="testBackend">${ic('activity', 16)} Cek /health</button>
        <button type="submit" class="btn btn-pri">Simpan</button>
      </div>
    </form>`, {
    onMount: el => {
      $('#sync-form', el).onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target);
        s.roomCode = String(f.get('room')).trim();
        s.backendUrl = String(f.get('url')).trim();
        s.ingestToken = String(f.get('token')).trim();
        Store.save(); closeSheet();
        toast('Konfigurasi sinkronisasi disimpan', { icon: 'checkCircle', tone: 'ok' });
        App.refresh();
      };
    },
  });
};
Actions.setRoleMode = el => {
  if (el.dataset.m === 'receiver') {
    Camera.stopWebcam();
    Camera.view.mode = 'remote';
    toast('Mode Penerima aktif — menunggu stream dari Unit Kamera', { icon: 'radio' });
  } else {
    Camera.view.mode = 'sim';
    toast('Mode Unit Kamera / Utama aktif', { icon: 'cctv' });
  }
  App.refresh();
};
Actions.testBackend = async () => {
  const inp = $('#sync-form input[name=url]');
  const url = (inp?.value || Store.s.settings.backendUrl || 'http://127.0.0.1:8000').replace(/\/$/, '');
  try {
    const r = await fetch(`${url}/health`);
    const j = await r.json();
    if (r.ok) {
      if (inp) inp.value = url;
      Store.s.settings.backendUrl = url; Store.save();
      toast(`Backend FastAPI Online (${j.status || 'ok'})`, { icon: 'checkCircle', tone: 'ok' });
    } else toast('Backend merespon dengan error', { icon: 'alert', tone: 'bad' });
  } catch (e) {
    toast(`Tidak dapat terhubung ke ${url}/health`, { icon: 'wifiOff', tone: 'warn' });
  }
};
