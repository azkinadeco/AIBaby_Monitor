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
const initials = n => (n || 'B').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
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

/* ---------------- SPLASH ---------------- */
Screens.splash = {
  render: () => `<div class="splash">
    <div class="splash-logo">${logo(88, '#fff')}</div>
    <h1>AI Baby Monitor</h1>
    <p>Kamu santai, AI yang jaga</p>
    <div class="splash-load"><i></i></div>
  </div>`,
  mount() { setTimeout(() => { if (App.route.name === 'splash') App.go(nextEntry(), {}, { reset: true }); }, 1100); },
};
function nextEntry() { return 'home'; }

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

function babyForm(setup) {
  const b = Store.s.baby;
  return `${setup ? '<div class="page-hero"><span class="step-pill">4 / 4</span><h1>Profil si kecil</h1><p>Agar AI dan pesan alarm lebih personal.</p></div>' : ''}
    <div class="baby-av">${ic('baby', 44)}<button class="mini-btn" data-act="noop">${ic('camera', 14)}</button></div>
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
Actions.noop = () => toast('Fitur foto profil tersedia di versi aplikasi', { icon: 'info' });

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
        <span class="who-av">${ic('baby', 22)}</span>
        <div><div class="hello">${esc(s.baby.name)}</div><div class="hi-k">${babyAge(s.baby.birth)}</div></div>
      </div>
      <div class="top-act">
        <button class="icon-btn soft" data-go="history" aria-label="Aktivitas">${ic('bell', 20)}<i class="dot-badge hidden" data-badge></i></button>
        ${guest ? `<button class="login-pill" data-go="auth">Masuk</button>` : `<button class="avatar" data-go="profile" aria-label="Profil">${initials(s.user?.name)}</button>`}
      </div>
    </header>
    <div class="pad-x">
      ${banner}
      <div class="hero" data-go="live" data-reset="1" role="button" aria-label="Buka live view">
        <canvas class="cam"></canvas>
        <div class="hero-top"><span class="live-pill"><i></i>LIVE</span></div>
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
let recTimer = null, recStart = 0;
Screens.live = {
  dark: true,
  render() {
    const s = Store.s, cam = s.cameras[0];
    const night = Engine.isNight();
    const lc = (act, icon, label, on = false) => `<button class="lc ${on ? 'on' : ''}" data-act="${act}" aria-label="${label}">${ic(icon, 22)}<span>${label}</span></button>`;
    return `
    <header class="bar dark">
      <span class="bar-sp"></span>
      <div class="bar-t"><h1>${esc(cam?.name || 'Kamera')}</h1></div>
      <span class="bar-sp"></span>
    </header>
    <div class="live-wrap" id="live-wrap">
      <canvas class="cam"></canvas>
      <div class="live-top"><span class="live-pill"><i></i>LIVE</span><span class="pill">${ic('activity', 12)} <span data-b="latency">-</span>s</span></div>
      <button class="live-fs" data-act="fullscreen" aria-label="Layar penuh">${ic('maximize', 18)}</button>
      <div class="live-status" data-tone="ok"><span data-b-icon="status" data-size="16"></span><b data-b="status">-</b></div>
    </div>
    <div class="live-ctrl five">
      ${lc('talkSheet', 'mic', 'Bicara')}
      ${lc('lullaby', 'music', 'Lagu', Sound.lullabyOn())}
      ${lc('liveAudio', s.settings.liveAudio ? 'volume' : 'volumeX', 'Dengar', s.settings.liveAudio)}
      ${lc('snapshot', 'camera', 'Foto')}
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
  mount() { if (Store.s.settings.liveAudio) Sound.roomAudio(true); },
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
// matikan audio kamar saat keluar dari live
const _render = App.render.bind(App);
App.render = function () {
  if (this.route.name !== 'live') Sound.roomAudio(false);
  _render();
};

/* ---------------- AKTIVITAS (notifikasi + riwayat) ---------------- */
Screens.history = {
  render({ tab = 'events', f = 'all' }) {
    const pending = Store.s.events.filter(e => !e.ack && e.level !== 'info');
    return `<header class="top"><div><div class="hello big">Aktivitas</div></div>
      <div class="top-act"><button class="icon-btn soft" data-go="settings" aria-label="Pengaturan">${ic('settings', 20)}</button></div></header>
    <div class="pad-x">
      <div class="seg seg-lg">
        <label><input type="radio" name="ht" ${tab === 'events' ? 'checked' : ''} data-go="history" data-param='{"tab":"events"}'><span>${ic('bell', 15)} Kejadian</span></label>
        <label><input type="radio" name="ht" ${tab === 'stats' ? 'checked' : ''} data-go="history" data-param='{"tab":"stats"}'><span>${ic('moon', 15)} Tidur</span></label>
      </div>
      ${tab === 'events' ? `
        ${pending.length ? `<button class="pending" data-act="ackAll">${ic('alert', 20)}<b>${pending.length} belum dicek</b><span>Konfirmasi ${ic('check', 16)}</span></button>` : ''}
        ${historyEvents(f)}` : historyStats()}
    </div>`;
  },
  mount() { setTimeout(() => { Store.s.readUpTo = Date.now(); Store.save(); updateBadges(); }, 1500); },
};
Screens.notif = Screens.history;
function historyEvents(f) {
  let list = Store.s.events;
  if (f === 'alert') list = list.filter(e => e.level !== 'info');
  const chips = [['all', 'Semua'], ['alert', 'Penting']];
  return `<div class="chips">${chips.map(([k, l]) => `<button class="chip ${f === k ? 'chip-on' : ''}" data-go="history" data-param='{"tab":"events","f":"${k}"}'>${l}</button>`).join('')}</div>
    ${groupByDay(list).map(g => `<div class="day-h">${g.d}</div><div class="card list ev-list">${g.items.map(eventRow).join('')}</div>`).join('') || `<div class="empty">${ic('bell', 40)}<p>Belum ada kejadian</p></div>`}`;
}
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
    <div class="card">${sleepTimeline()}</div>`;
}
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
        <span class="baby-av sm">${ic('baby', 26)}</span>
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
    return topbar('Perangkat Saya') + `<div class="pad">
      <div class="sec-h"><h3>Kamera</h3></div>
      ${s.cameras.map(c => `<div class="card dev">
        <div class="dev-h">${ic('cctv', 24)}<div><b>${esc(c.name)}</b><small>${esc(c.brand)}</small></div>${Engine.sim.camOnline ? '<span class="chip chip-ok">Online</span>' : '<span class="chip chip-bad">Offline</span>'}</div>
        <div class="kv"><span>Koneksi</span><b>${c.type === 'rtsp' ? 'RTSP via gateway' : 'Cloud P2P'}</b></div>
        ${c.url ? `<div class="kv"><span>URL</span><b class="mono">${esc(c.url)}</b></div>` : `<div class="kv"><span>No. Seri</span><b class="mono">${esc(c.sn || '-')}</b></div><div class="kv"><span>Wi-Fi</span><b>${esc(c.wifi || '-')} · ${ic('wifi', 13)} Kuat</b></div>`}
        <div class="kv"><span>Resolusi</span><b>${c.res} · night vision</b></div>
        <div class="btn-row"><button class="btn btn-soft btn-sm" data-act="restartDev">${ic('power', 16)} Mulai ulang</button><button class="btn btn-soft btn-sm danger" data-act="delCam" data-id="${c.id}">${ic('trash', 16)} Hapus</button></div>
      </div>`).join('') || '<p class="muted">Belum ada kamera.</p>'}
      <button class="btn btn-ghost" data-go="setup" data-param='{"step":"camera","add":true}'>${ic('plus', 18)} Tambah kamera</button>

      <div class="sec-h"><h3>Speaker Alarm</h3></div>
      ${s.speakers.map(sp => `<div class="card dev">
        <div class="dev-h">${ic(SPEAKER_TYPES[sp.type].icon, 24)}<div><b>${esc(sp.name)}</b><small>${SPEAKER_TYPES[sp.type].name}</small></div><span class="chip chip-ok">Online</span></div>
        <div class="set-row col"><div class="set-lr"><b>Volume perangkat</b><span id="sv-${sp.id}">${sp.volume}%</span></div>
          <input type="range" min="10" max="100" step="5" value="${sp.volume}" data-act="noopRange" data-spk="${sp.id}" data-out="#sv-${sp.id}" data-unit="%"></div>
        <div class="btn-row"><button class="btn btn-soft btn-sm" data-act="testSpeaker">${ic('volume', 16)} Tes</button><button class="btn btn-soft btn-sm danger" data-act="delSpk" data-id="${sp.id}">${ic('trash', 16)} Hapus</button></div>
      </div>`).join('') || '<div class="tip warn">' + ic('alert', 18) + '<span>Belum ada speaker. Alarm hanya akan muncul di HP.</span></div>'}
      <button class="btn btn-ghost" data-go="setup" data-param='{"step":"speaker","add":true}'>${ic('plus', 18)} Tambah speaker</button>

    </div>`;
  },
};
document.addEventListener('change', e => {
  const el = e.target.closest('[data-spk]'); if (!el) return;
  const sp = Store.s.speakers.find(x => x.id === el.dataset.spk); if (sp) { sp.volume = +el.value; Store.save(); }
});
Actions.noopRange = () => {};
Actions.restartDev = () => { toast('Kamera dimulai ulang…', { icon: 'power' }); Engine.setCamera(false); setTimeout(() => { Engine.setCamera(true); toast('Kamera online kembali', { icon: 'cctv', tone: 'ok' }); if (App.route.name === 'devices') App.refresh(); }, 3500); };
Actions.delCam = async el => { if (await confirmBox('Hapus kamera?', 'Kamera akan diputus dari akun ini.', 'Hapus', true)) { Store.s.cameras = Store.s.cameras.filter(c => c.id !== el.dataset.id); Store.save(); App.refresh(); } };
Actions.delSpk = async el => { if (await confirmBox('Hapus speaker?', 'Alarm tidak akan dibunyikan ke speaker ini lagi.', 'Hapus', true)) { Store.s.speakers = Store.s.speakers.filter(c => c.id !== el.dataset.id); Store.save(); SpeakerUI.idle(); App.refresh(); } };

/* ---------------- KELUARGA ---------------- */
Screens.family = {
  render() {
    const s = Store.s;
    return topbar('Anggota Keluarga') + `<div class="pad">
      <p class="muted">Semua anggota menerima notifikasi. Jika alarm tidak dikonfirmasi dalam ${s.settings.alarm.escalateSec || '–'} dtk, peringatan diteruskan ke anggota yang aktif.</p>
      <div class="card list">
        <div class="li"><span class="avatar sm">${initials(s.user?.name)}</span><span><b>${esc(s.user?.name)} (Anda)</b><small>${esc(s.user?.email)} · Pemilik</small></span><span class="chip chip-pri">Admin</span></div>
        ${s.family.map(f => `<div class="li"><span class="avatar sm alt">${initials(f.name)}</span><span><b>${esc(f.name)}</b><small>${esc(f.email)} · ${f.role}${f.pending ? ' · undangan terkirim' : ''}</small></span>
          <label class="switch"><input type="checkbox" ${f.notify ? 'checked' : ''} data-act="famNotify" data-id="${f.id}"><i></i></label></div>`).join('')}
      </div>
      <div class="sec-h"><h3>Undang anggota</h3></div>
      <form class="form card" id="fam-form">
        <label class="field"><span>Nama</span><input name="name" required placeholder="cth. Mbak Asih"></label>
        <label class="field"><span>Email / No. HP</span><input name="email" required placeholder="email atau nomor WhatsApp"></label>
        <div class="field"><span>Peran</span><div class="seg"><label><input type="radio" name="role" value="Orang Tua" checked><span>Orang Tua</span></label><label><input type="radio" name="role" value="Pengasuh"><span>Pengasuh</span></label><label><input type="radio" name="role" value="Lihat saja"><span>Lihat saja</span></label></div></div>
        <button class="btn btn-pri">${ic('mail', 18)} Kirim Undangan</button>
      </form>
    </div>`;
  },
  mount() {
    $('#fam-form').onsubmit = e => {
      e.preventDefault(); const f = new FormData(e.target);
      Store.s.family.push({ id: uid(), name: f.get('name'), email: f.get('email'), role: f.get('role'), notify: true, pending: true });
      Store.save(); toast(`Undangan dikirim ke ${f.get('name')}`, { icon: 'mail' }); App.refresh();
    };
  },
};
Actions.famNotify = el => { setTimeout(() => { const f = Store.s.family.find(x => x.id === el.dataset.id); if (f) { f.notify = el.checked; Store.save(); } }, 0); };

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
        <div class="set-row"><div class="set-main"><b>Kunci aplikasi (PIN / Face ID)</b><small>Minta PIN saat membuka aplikasi</small></div>${toggle('settings.pin', S.pin)}</div>
        <div class="set-row"><div class="set-main"><b>Enkripsi end-to-end</b><small>Selalu aktif untuk semua stream</small></div><span class="chip chip-ok">Aktif</span></div>
      </div>
      <div class="sec-h"><h3>Sesi aktif</h3></div>
      <div class="card list">
        <div class="li">${ic('phone', 20)}<span><b>Perangkat ini</b><small>Aktif sekarang</small></span><span class="chip chip-ok">Saat ini</span></div>
        <div class="li">${ic('phone', 20)}<span><b>iPhone 13 — Budi</b><small>Jakarta · 2 jam lalu</small></span><button class="btn btn-sm btn-soft" data-act="revoke">Keluarkan</button></div>
      </div>
      <div class="sec-h"><h3>Data & privasi</h3></div>
      <div class="card list">
        <button class="li" data-act="exportCsv">${ic('download', 20)}<span><b>Unduh data saya</b><small>Riwayat kejadian (CSV)</small></span>${ic('chevR', 18)}</button>
        <button class="li danger" data-act="wipeRec">${ic('trash', 20)}<span><b>Hapus semua rekaman & cuplikan</b></span>${ic('chevR', 18)}</button>
      </div>
    </div>`;
  },
};
Actions.revoke = el => { el.closest('.li').remove(); toast('Sesi dikeluarkan'); };
Actions.wipeRec = async () => { if (await confirmBox('Hapus semua rekaman?', 'Semua cuplikan kejadian akan dihapus permanen dari cloud dan perangkat ini.', 'Hapus', true)) { Store.s.events.forEach(e => delete e.snap); Store.save(); toast('Semua rekaman dihapus'); } };

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
