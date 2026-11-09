/* Inti aplikasi: router, helper UI, toast, sheet, alarm overlay, binding data live */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const pad2 = n => String(n).padStart(2, '0');
const fmtTime = ts => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtTimeS = ts => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
const fmtDay = ts => {
  const d = new Date(ts), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Hari ini';
  if (d.toDateString() === y.toDateString()) return 'Kemarin';
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
};
const fmtAgo = ts => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
};
const fmtDur = sec => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h}j ${m}m` : `${m}m`; };
const rupiah = n => 'Rp ' + n.toLocaleString('id-ID');
function babyAge(birth) {
  const b = new Date(birth), n = new Date();
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  let days = n.getDate() - b.getDate();
  if (days < 0) { months--; const pm = new Date(n.getFullYear(), n.getMonth(), 0).getDate(); days += pm; }
  if (months < 0) return 'baru lahir';
  return months ? `${months} bulan ${days} hari` : `${days} hari`;
}
function greet() {
  const h = new Date().getHours();
  return h < 4 ? 'Selamat malam' : h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}
function inQuietHours() {
  const q = Store.s.settings.quiet; if (!q.on) return false;
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = q.from.split(':').map(Number), [th, tm] = q.to.split(':').map(Number);
  const f = fh * 60 + fm, t = th * 60 + tm;
  return f <= t ? (m >= f && m < t) : (m >= f || m < t);
}
const parentName = () => (Store.s.user?.name || 'Bunda').split(' ')[0];

/* ================= Router ================= */
const TABS = [
  { id: 'home', label: 'Beranda', icon: 'home' },
  { id: 'live', label: 'Live', icon: 'video' },
  { id: 'history', label: 'Aktivitas', icon: 'bell' },
];
const Screens = {};
/* fitur yang butuh login (mode demo bisa lihat beranda & live) */
const LOCKED = {
  notif: 'melihat notifikasi', history: 'melihat riwayat & analitik', eventDetail: 'melihat detail kejadian',
  settings: 'mengatur alarm', devices: 'mengelola perangkat', family: 'mengundang keluarga', subscription: 'mengatur paket',
  security: 'mengatur keamanan', baby: 'mengubah profil bayi', plan: 'memilih paket', setup: 'menghubungkan kamera',
};   // diisi di screens.js
const App = {
  route: { name: 'splash', params: {} },
  stack: [],
  go(name, params = {}, { replace = false, reset = false } = {}) {
    const why = LOCKED[name];
    if (why && !Store.s.user) { loginSheet(why); return; }
    if (reset) this.stack = [];
    else if (!replace && this.route.name !== name) this.stack.push(this.route);
    this.route = { name, params };
    this.render();
  },
  back() {
    const prev = this.stack.pop();
    if (prev) { this.route = prev; this.render(); }
    else this.go('home', {}, { reset: true });
  },
  render() {
    const scr = $('#screen');
    const def = Screens[this.route.name];
    if (!def) { scr.innerHTML = `<div class="pad">Layar "${esc(this.route.name)}" tidak ditemukan</div>`; return; }
    const isTab = TABS.some(t => t.id === this.route.name) || this.route.name === 'notif';
    scr.className = 'screen' + (def.dark ? ' dark' : '') + (isTab ? ' has-tabs' : '');
    $('#device').classList.toggle('dark-status', !!def.dark);
    scr.innerHTML = def.render(this.route.params);
    scr.scrollTop = 0;
    if (!this._quiet) { scr.classList.remove('enter'); void scr.offsetWidth; scr.classList.add('enter'); }
    renderTabbar(isTab ? (this.route.name === 'notif' ? 'history' : this.route.name) : null);
    $('#sim-fab').classList.toggle('hidden', ['splash', 'auth', 'plan', 'setup', 'onboarding'].includes(this.route.name));
    def.mount && def.mount(this.route.params, scr);
    Player.bar();
    Camera.scan(scr);
    updateBindings();
    updateBadges();
  },
  refresh() {
    const scr = $('#screen'); const top = scr.scrollTop;
    this._quiet = true; this.render(); this._quiet = false; scr.scrollTop = top;
  },
};

function renderTabbar(active) {
  const tb = $('#tabbar');
  if (!active) { tb.classList.add('hidden'); tb.innerHTML = ''; return; }
  tb.classList.remove('hidden');
  tb.innerHTML = TABS.map(t => `
    <button class="tab ${t.id === active ? 'on' : ''} ${t.id === 'live' ? 'tab-live' : ''}" data-go="${t.id}" data-reset="1" aria-label="${t.label}">
      <span class="tab-ic">${ic(t.icon, 22)}${t.id === 'history' ? '<i class="tab-badge hidden" data-badge></i>' : ''}</span>
      <span>${t.label}</span>
    </button>`).join('');
}

function unreadCount() { return Store.s.events.filter(e => e.ts > Store.s.readUpTo).length; }
function updateBadges() {
  const n = unreadCount();
  $$('[data-badge]').forEach(b => { b.textContent = n > 9 ? '9+' : n; b.classList.toggle('hidden', !n); });
}

/* ================= Binding data live ================= */
function updateBindings() {
  const L = Engine.live, S = Engine.STATUS[Store.s.armed ? L.status : (L.status === 'offline' ? 'offline' : 'paused')] || Engine.STATUS.sleep;
  const statusKey = Store.s.armed ? L.status : 'paused';
  const set = (k, v) => $$(`[data-b="${k}"]`).forEach(el => { if (el.textContent !== String(v)) el.textContent = v; });
  set('db', Math.round(L.db));
  set('motion', Math.round(L.motion));
  set('rpm', Math.round(L.rpm));
  set('pose', L.pose);
  set('conf', L.conf);
  set('latency', L.latency);
  set('status', S.text);
  set('statusSub', S.sub);
  set('sleptToday', fmtDur(Store.s.stats.sleptToday + todayBaseSleep()));
  set('clock', fmtTimeS(Date.now()));
  $$('[data-tone]').forEach(el => { el.dataset.tone = S.tone; });
  $$('[data-b-icon="status"]').forEach(el => { if (el.dataset.k !== statusKey) { el.dataset.k = statusKey; el.innerHTML = ic(S.icon, el.dataset.size ? +el.dataset.size : 26); } });
  $$('[data-bar]').forEach(el => {
    const k = el.dataset.bar, max = { db: 100, motion: 100, rpm: 80 }[k];
    el.style.width = Math.min(100, (L[k] / max) * 100) + '%';
  });
  $$('[data-metric]').forEach(el => {
    const k = el.dataset.metric; let tone = 'ok';
    if (k === 'db') tone = L.db >= 65 ? 'bad' : L.db >= 50 ? 'warn' : 'ok';
    if (k === 'motion') tone = L.motion >= 60 ? 'bad' : L.motion >= 30 ? 'warn' : 'ok';
    if (k === 'rpm') tone = (L.rpm >= 60 || L.rpm <= 18) ? 'bad' : L.rpm >= 50 ? 'warn' : 'ok';
    if (k === 'pose') tone = L.pose === 'Tengkurap' ? 'bad' : L.pose === 'Telentang' ? 'ok' : 'warn';
    el.dataset.mt = tone;
  });
  $$('canvas.spark').forEach(drawSpark);
  const sb = $('#sb-time'); if (sb) sb.textContent = fmtTime(Date.now());
}
function todayBaseSleep() {
  // tidur sebelum aplikasi dibuka (dummy) — dihitung dari jam saat ini
  const h = new Date().getHours();
  return Math.min(h, 9) * 3000 + 1800;
}
function drawSpark(cv) {
  const key = cv.dataset.key, data = Engine.hist[key];
  const w = cv.clientWidth || 280, h = cv.clientHeight || 48, dpr = window.devicePixelRatio || 1;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  if (data.length < 2) return;
  const max = { db: 100, motion: 100, rpm: 80 }[key], min = key === 'db' ? 20 : 0;
  const col = cv.dataset.color || '#5B6CF9';
  const pts = data.map((v, i) => [i * (w / 59), h - 4 - ((v - min) / (max - min)) * (h - 8)]);
  const off = (60 - data.length) * (w / 59);
  x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px + off, py) : x.moveTo(px + off, py)));
  x.strokeStyle = col; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
  x.lineTo(pts[pts.length - 1][0] + off, h); x.lineTo(pts[0][0] + off, h); x.closePath();
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col + '40'); g.addColorStop(1, col + '00');
  x.fillStyle = g; x.fill();
  if (key === 'db') { const ty = h - 4 - ((65 - min) / (max - min)) * (h - 8); x.setLineDash([4, 4]); x.strokeStyle = '#EE435788'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, ty); x.lineTo(w, ty); x.stroke(); x.setLineDash([]); }
}

/* ================= Toast, Sheet, Modal ================= */
function toast(msg, { icon = 'checkCircle', tone = 'dark', ms = 2600 } = {}) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast t-${tone}`;
  el.innerHTML = `${ic(icon, 18)}<span>${msg}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms);
}
function sheet(html, { onMount, cls = '' } = {}) {
  closeSheet();
  const root = $('#overlay-root');
  const el = document.createElement('div');
  el.className = 'sheet-wrap'; el.id = 'sheet';
  el.innerHTML = `<div class="sheet-bg" data-act="closeSheet"></div><div class="sheet ${cls}"><div class="sheet-grip"></div>${html}</div>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  onMount && onMount(el);
  Camera.scan(el);
  return el;
}
function closeSheet() {
  const el = $('#sheet'); if (!el) return;
  el.classList.remove('in'); el.id = '';
  setTimeout(() => el.remove(), 250);
}
function confirmBox(title, msg, okLabel = 'Ya', danger = false) {
  return new Promise(res => {
    sheet(`<h3 class="sheet-title">${title}</h3><p class="muted">${msg}</p>
      <div class="btn-row"><button class="btn btn-soft" data-r="0">Batal</button><button class="btn ${danger ? 'btn-bad' : 'btn-pri'}" data-r="1">${okLabel}</button></div>`,
    { onMount: el => $$('[data-r]', el).forEach(b => b.onclick = () => { closeSheet(); res(b.dataset.r === '1'); }) });
  });
}

/* ================= Alarm ================= */
const Alarm = {
  current: null, escTimer: null, escLeft: 0, muted: false,
  handle(ev) {
    const s = Store.s.settings, T = Engine.TYPES[ev.type];
    const quiet = inQuietHours();
    const speakerOn = Store.s.speakers.some(sp => sp.status === 'online');
    const shouldSound = speakerOn && (ev.level === 'critical' || (ev.level === 'warning' && !quiet) || (ev.level === 'info' && s.alarm.wakeSpeaker && !quiet));
    if (s.vibrate && navigator.vibrate) { try { navigator.vibrate(ev.level === 'critical' ? [400, 150, 400, 150, 400] : [250, 100, 250]); } catch (e) { /* */ } }
    systemNotify(ev);

    if (ev.level === 'info') {
      toast(`${T.label} · ${fmtTime(ev.ts)}`, { icon: T.icon, tone: 'info', ms: 3500 });
      if (shouldSound) { SpeakerUI.ring(T.label, 'info'); Sound.speak(T.speak(Store.s.baby.name), s.alarm.volume / 100).then(() => SpeakerUI.idle()); }
      updateBadges(); if (App.route.name === 'notif' || App.route.name === 'home') App.refresh();
      return;
    }
    // jangan menimpa alarm kritis dengan peringatan level lebih rendah
    if (this.current && this.current.level === 'critical' && ev.level !== 'critical') {
      toast(`Juga terdeteksi: ${T.label}`, { icon: 'alert', tone: 'warn' });
      updateBadges(); return;
    }
    this.current = ev; this.muted = false;
    this.show(ev, { quiet, shouldSound, speakerOn });
    if (shouldSound) this.sound(ev);
    else SpeakerUI.idle();
    this.startEscalation(ev);
    updateBadges();
    if (['home', 'history'].includes(App.route.name)) App.refresh();
  },
  sound(ev) {
    const s = Store.s.settings, T = Engine.TYPES[ev.type];
    const sp = Store.s.speakers.find(x => x.status === 'online');
    const vol = Math.max(s.alarm.volume, ev.level === 'critical' ? 90 : 0) * ((sp?.volume ?? 100) / 100);
    SpeakerUI.ring(T.label, ev.level);
    Sound.startAlarm({ style: s.alarm.sound, volume: vol, text: T.speak(Store.s.baby.name), tts: s.alarm.tts });
  },
  show(ev, { quiet, shouldSound, speakerOn }) {
    const T = Engine.TYPES[ev.type];
    $('#alarm')?.remove();
    const el = document.createElement('div');
    el.id = 'alarm'; el.className = `alarm lv-${ev.level}`;
    const spkChip = shouldSound ? `${ic('volume', 15)}<b>ON</b>` : !speakerOn ? `${ic('volumeX', 15)}<b>-</b>` : `${ic('moon', 15)}<b>Tenang</b>`;
    el.innerHTML = `
      <div class="alarm-rings"><i></i><i></i><i></i></div>
      <div class="alarm-body">
        <div class="alarm-kicker">${fmtTime(ev.ts)}</div>
        <div class="alarm-ico">${ic(T.icon, 34)}</div>
        <h2>${T.label}</h2>
        <div class="alarm-snap"><canvas class="cam"></canvas><span class="live-pill"><i></i>LIVE</span></div>
        <div class="a-chips">
          <span class="a-chip" id="alarm-spk" title="Speaker">${spkChip}</span>
          <span class="a-chip" title="Latensi">${ic('activity', 15)}<b>${ev.latency}s</b></span>
          <span class="a-chip" id="alarm-esc" title="Eskalasi ke keluarga"></span>
        </div>
        <button class="btn btn-white btn-lg" data-act="ack">${ic('check', 20)} Sudah saya cek</button>
        <div class="a-round">
          <button data-act="alarmLive"><span>${ic('video', 20)}</span>Live</button>
          <button data-act="alarmMute" id="alarm-mute"><span>${ic('volumeX', 20)}</span>Bisu</button>
          <button data-act="alarmFalse"><span>${ic('flag', 20)}</span>Palsu</button>
        </div>
      </div>`;
    $('#overlay-root').appendChild(el);
    Camera.scan(el);
    requestAnimationFrame(() => el.classList.add('in'));
  },
  startEscalation(ev) {
    clearInterval(this.escTimer);
    const fam = Store.s.user ? Store.s.family.filter(f => f.notify) : [];
    this.escLeft = Store.s.settings.alarm.escalateSec;
    const upd = () => {
      const el = $('#alarm-esc'); if (!el) return;
      if (!fam.length) { el.classList.add('hidden'); return; }
      el.innerHTML = this.escLeft > 0 ? `${ic('users', 15)}<b>${this.escLeft}s</b>` : `${ic('users', 15)}${ic('check', 14)}`;
    };
    upd();
    if (!this.escLeft || !fam.length) return;
    this.escTimer = setInterval(() => {
      this.escLeft--; upd();
      if (this.escLeft <= 0) {
        clearInterval(this.escTimer);
        const e = Store.s.events.find(x => x.id === ev.id);
        if (e) { e.escalated = fam.map(f => f.name); Store.save(); }
        toast(`Belum dikonfirmasi — peringatan diteruskan ke ${fam.length} anggota keluarga`, { icon: 'users', tone: 'warn', ms: 4000 });
        SimPanel.log(`Eskalasi: notifikasi ke ${fam.map(f => f.name).join(', ')}`);
      }
    }, 1000);
  },
  ack(falseAlarm = false) {
    const now = Date.now();
    Store.s.events.forEach(e => {
      if (!e.ack && e.level !== 'info') { e.ack = true; e.ackAt = now; e.ackBy = Store.s.user?.name || 'Bunda'; e.ackSec = Math.round((now - e.ts) / 1000); }
    });
    if (falseAlarm && this.current) { const e = Store.s.events.find(x => x.id === this.current.id); if (e) e.falseAlarm = true; }
    Store.save();
    this.stop();
    if (falseAlarm) toast('Terima kasih — masukan dipakai untuk melatih AI', { icon: 'sparkles' });
    else { toast('Dikonfirmasi. Speaker dimatikan', { icon: 'checkCircle', tone: 'ok' }); Engine.resolveByParent(); }
    SimPanel.log(falseAlarm ? 'Orang tua menandai alarm palsu' : `Dikonfirmasi oleh ${Store.s.user?.name || 'Bunda'}`);
    if (falseAlarm) Engine.setBaby('sleep');
    App.refresh();
  },
  stop() {
    Sound.stopAlarm(); SpeakerUI.idle();
    clearInterval(this.escTimer);
    this.current = null;
    $('#alarm-pill')?.remove();
    const el = $('#alarm'); if (el) { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }
  },
  mute() {
    this.muted = !this.muted;
    if (this.muted) { Sound.stopAlarm(); SpeakerUI.idle(); }
    else if (this.current) this.sound(this.current);
    const b = $('#alarm-mute'); if (b) b.innerHTML = this.muted ? `<span>${ic('volume', 20)}</span>Bunyi` : `<span>${ic('volumeX', 20)}</span>Bisu`;
    const sp = $('#alarm-spk'); if (sp) sp.innerHTML = this.muted ? `${ic('volumeX', 15)}<b>Bisu</b>` : `${ic('volume', 15)}<b>ON</b>`;
  },
};

function systemNotify(ev) {
  if (!Store.s.settings.push || !('Notification' in window)) return;
  if (Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  const T = Engine.TYPES[ev.type];
  try { new Notification(`AI Baby Monitor — ${T.label}`, { body: T.desc, icon: 'assets/icon.svg', tag: ev.type }); } catch (e) { /* */ }
}

/* Visual "speaker fisik" di panel simulasi */
const SpeakerUI = {
  ring(label, level) {
    $$('.spk-dev').forEach(d => { d.dataset.state = level === 'info' ? 'info' : 'alarm'; });
    $$('[data-spk-label]').forEach(d => { d.textContent = level === 'info' ? `Mengumumkan: ${label}` : `ALARM: ${label}`; });
    $$('.speaker-chip').forEach(d => d.classList.add('ringing'));
  },
  idle() {
    $$('.spk-dev').forEach(d => { d.dataset.state = Store.s.speakers.some(s => s.status === 'online') ? 'idle' : 'off'; });
    $$('[data-spk-label]').forEach(d => { d.textContent = Store.s.speakers.length ? 'Standby — siap membunyikan alarm' : 'Belum ada speaker'; });
    $$('.speaker-chip').forEach(d => d.classList.remove('ringing'));
  },
};

/* ================= Event delegation ================= */
const Actions = {};   // diisi di screens.js & sim.js
document.addEventListener('click', e => {
  Sound.unlock();
  if (e.target.closest('button') && navigator.vibrate && Store.s.settings.vibrate) { try { navigator.vibrate(8); } catch (err) { /* */ } }
  const go = e.target.closest('[data-go]');
  if (go) { e.preventDefault(); if (go.closest('#sheet')) closeSheet(); App.go(go.dataset.go, go.dataset.param ? JSON.parse(go.dataset.param) : {}, { reset: !!go.dataset.reset }); return; }
  const a = e.target.closest('[data-act]');
  if (a) {
    const fn = Actions[a.dataset.act];
    if (fn) { e.preventDefault(); fn(a, e); }
  }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-set]'); if (!el) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num) v = Number(v);
  Store.setPath(el.dataset.set, v);
  if (el.dataset.after && Actions[el.dataset.after]) Actions[el.dataset.after](el);
});
document.addEventListener('input', e => {
  const el = e.target.closest('input[type=range][data-out]'); if (!el) return;
  const out = $(el.dataset.out); if (out) out.textContent = el.value + (el.dataset.unit || '');
});

/* Hook mesin */
Engine.on('tick', () => updateBindings());
Engine.on('alert', ev => Alarm.handle(ev));
Engine.on('net', onl => {
  const b = $('#net-banner');
  b.classList.toggle('hidden', onl);
  b.innerHTML = `${ic('wifiOff', 16)} Internet terputus · gateway lokal aktif, alarm tetap berjalan`;
  if (onl) toast('Internet tersambung kembali', { icon: 'wifi', tone: 'ok' });
});

Actions.closeSheet = () => closeSheet();
Actions.back = () => App.back();
Actions.ack = () => Alarm.ack(false);
Actions.alarmFalse = () => Alarm.ack(true);
Actions.alarmMute = () => Alarm.mute();
Actions.alarmLive = () => { const el = $('#alarm'); if (el) el.classList.add('minimized'); App.go('live'); showAlarmPill(); };

function showAlarmPill() {
  $('#alarm-pill')?.remove();
  if (!Alarm.current) return;
  const T = Engine.TYPES[Alarm.current.type];
  const p = document.createElement('button');
  p.id = 'alarm-pill'; p.className = `alarm-pill lv-${Alarm.current.level}`;
  p.innerHTML = `${ic('alert', 16)} ${T.label} — ketuk untuk konfirmasi`;
  p.onclick = () => { $('#alarm')?.classList.remove('minimized'); p.remove(); };
  $('#overlay-root').appendChild(p);
}

/* ================= Pemutar lagu tidur (mini player + sheet) ================= */
const Player = {
  endAt: 0, timer: null, tick: null, mins: 30,
  play(track) {
    Sound.lullPlay(track);
    Camera.view.lullaby = true;
    this.setTimer(this.mins);
    this.sync();
  },
  stop() {
    Sound.lullStop();
    Camera.view.lullaby = false;
    clearTimeout(this.timer); clearInterval(this.tick); this.endAt = 0;
    this.sync();
  },
  setTimer(m) {
    this.mins = m;
    clearTimeout(this.timer); clearInterval(this.tick);
    if (m && Sound.lullabyOn()) {
      this.endAt = Date.now() + m * 60000;
      this.timer = setTimeout(() => { this.stop(); toast('Lagu tidur berhenti otomatis', { icon: 'moon' }); }, m * 60000);
      this.tick = setInterval(() => this.updLeft(), 1000);
    } else this.endAt = 0;
    this.updLeft();
  },
  left() {
    if (!this.endAt) return '∞';
    const s = Math.max(0, Math.round((this.endAt - Date.now()) / 1000));
    return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
  },
  updLeft() { $$('[data-pl-left]').forEach(el => { el.textContent = this.left(); }); },
  sync() {
    const on = Sound.lullabyOn();
    $$('[data-act=lullaby]').forEach(b => {
      b.classList.toggle('on', on);
      const sm = b.querySelector('small'); if (sm) sm.textContent = on ? 'Diputar' : 'Lagu';
    });
    this.bar();
    if ($('#sheet .pl-sheet')) this.open(true);
  },
  bar() {
    $('#pl-bar')?.remove();
    $('#device').classList.toggle('has-player', Sound.lullabyOn());
    if (!Sound.lullabyOn()) return;
    const T = Sound.TRACKS[Sound.lullabyTrack()];
    const el = document.createElement('div');
    el.id = 'pl-bar'; el.className = 'pl-bar' + ($('#tabbar').classList.contains('hidden') ? ' low' : '');
    el.innerHTML = `
      <button class="pl-main" data-act="playerOpen"><span class="eq"><i></i><i></i><i></i><i></i></span>
        <span class="pl-t"><b>${T.name}</b><small>${ic('clock', 11)} <span data-pl-left>${this.left()}</span></small></span></button>
      <button class="pl-stop" data-act="playerStop" aria-label="Hentikan lagu">${ic('pause', 18)}</button>`;
    $('#overlay-root').appendChild(el);
  },
  open(refresh) {
    const on = Sound.lullabyOn(), cur = Sound.lullabyTrack();
    const tr = Object.entries(Sound.TRACKS).map(([k, t]) => `
      <button class="trk ${on && cur === k ? 'on' : ''}" data-act="playerPick" data-k="${k}">
        <span class="trk-ic">${ic(t.noise ? 'wind' : 'music', 22)}</span><b>${t.name}</b>
        <span class="trk-st">${on && cur === k ? '<span class="eq sm"><i></i><i></i><i></i></span>' : ic('play', 16)}</span>
      </button>`).join('');
    const html = `<div class="pl-sheet">
      <h3 class="sheet-title">${ic('music', 18)} Lagu tidur</h3>
      <div class="trk-list">${tr}</div>
      <div class="grp-h">${ic('clock', 15)}<b>Timer</b></div>
      <div class="opt-grid four">${[[15, '15m'], [30, '30m'], [60, '60m'], [0, '∞']].map(([m, l]) => `<button class="opt ${this.mins === m ? 'on' : ''}" data-act="playerTimer" data-m="${m}"><span>${l}</span></button>`).join('')}</div>
      <div class="card vol">${ic('volumeX', 18)}<input type="range" min="0.1" max="1" step="0.05" value="${Sound.lullVolume}" id="pl-vol" aria-label="Volume lagu">${ic('volume', 18)}</div>
      ${on ? `<button class="btn btn-bad btn-lg" data-act="playerStop">${ic('pause', 18)} Hentikan · <span data-pl-left>${this.left()}</span></button>` : ''}
    </div>`;
    if (refresh && $('#sheet .sheet')) { $('#sheet .sheet').innerHTML = '<div class="sheet-grip"></div>' + html; this.bindVol(); return; }
    sheet(html, { onMount: () => this.bindVol() });
  },
  bindVol() { const v = $('#pl-vol'); if (v) v.oninput = () => Sound.lullVol(+v.value); },
};
Actions.playerOpen = () => Player.open();
Actions.playerStop = () => { Player.stop(); toast('Lagu dihentikan', { icon: 'pause' }); };
Actions.playerPick = el => {
  const k = el.dataset.k;
  if (Sound.lullabyOn() && Sound.lullabyTrack() === k) { Player.stop(); return; }
  Player.play(k);
};
Actions.playerTimer = el => { Player.setTimer(+el.dataset.m); if ($('#sheet .pl-sheet')) Player.open(true); };

/* Tampilkan jam di status bar */
setInterval(() => { const sb = $('#sb-time'); if (sb) sb.textContent = fmtTime(Date.now()); }, 15000);
