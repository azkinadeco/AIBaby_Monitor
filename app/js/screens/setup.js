/* PEMBUKA, PEMASANGAN (pairing), PERANGKAT, dan PANEL DEMO. */
import { $, $$, esc } from '../core/util.js';
import { ic, logo } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { actions, sheet, closeSheet, toast, confirmBox, topbar } from '../core/ui.js';
import { link } from '../services/link.js';
import { live, localCam, STATUS } from '../services/monitor.js';
import { sim, SIM_STATES, autoDemo } from '../services/sim.js';
import { babyUnit } from '../services/babyUnit.js';
import { applyListen } from '../services/control.js';
import { linkLabel } from './shared.js';

/* ================= Pembuka ================= */
route('welcome', {
  render() {
    return `<div class="welcome">
      <div class="wl-sky" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="wl-logo">${logo(64)}</div>
      <h1>Tidur nyenyak.<br><em>Si kecil tetap terjaga.</em></h1>
      <p>Pakai dua HP: satu di kamar bayi sebagai kamera, satu di tanganmu sebagai monitor dengan alarm.</p>
      <div class="choices">
        <button class="choice" data-go="connect"><span class="choice-ic tone-pri">${ic('phone', 24)}</span><span><b>HP ini untuk orang tua</b><small>Lihat, dengar, dan terima alarm</small></span>${ic('chevR', 18)}</button>
        <button class="choice" data-go="babycam"><span class="choice-ic tone-accent">${ic('cctv', 24)}</span><span><b>Jadikan HP ini kamera bayi</b><small>HP lama pun bisa — letakkan dekat boks</small></span>${ic('chevR', 18)}</button>
        <button class="choice ghost" data-act="startDemo"><span class="choice-ic">${ic('flask', 22)}</span><span><b>Coba dulu (mode demo)</b><small>Bayi simulasi, tanpa perangkat</small></span>${ic('chevR', 18)}</button>
      </div>
    </div>`;
  },
});
actions.startDemo = () => {
  if (store.s.mode === 'baby') babyUnit.stop();
  if (store.s.mode === 'parent') link.leave();
  store.s.mode = 'demo'; store.s.onboarded = true; store.save();
  applyListen();
  router.go('home', { replace: true });
};

/* ================= Sambungkan ke kamera bayi (HP orang tua) ================= */
const STATE_TEXT = {
  connecting: ['link', 'Menyambungkan ke kamera bayi…', ''],
  connected: ['checkCircle', 'Tersambung!', 'ok'],
  notfound: ['wifiOff', 'Kamera bayi tidak ditemukan. Pastikan aplikasinya terbuka di mode kamera & tersambung internet. Mencoba lagi…', 'warn'],
  denied: ['lock', 'Kunci salah. Periksa 6 angka di layar HP kamera.', 'bad'],
  error: ['alert', 'Gagal tersambung. Mencoba lagi…', 'bad'],
  lost: ['wifiOff', 'Sambungan terputus. Mencoba lagi…', 'warn'],
};
function connectStatus() {
  const st = STATE_TEXT[link.state];
  return st && link.role === 'parent' ? `<div class="note ${st[2]}">${ic(st[0], 16)} <span>${st[1]}</span></div>` : '';
}
route('connect', {
  render({ c = '', k = '' }) {
    const p = store.s.pair;
    const code = (c || p.code || '').toUpperCase(), key = k || p.secret || '';
    return `${topbar('Sambungkan kamera')}
    <div class="stack">
      <div class="steps-ill">
        <div><span>1</span><p>HP kamera → <b>Jadikan kamera bayi</b></p></div>
        <div><span>2</span><p>Pindai QR, atau ketik kode</p></div>
      </div>
      <form class="form card" id="pair-form" autocomplete="off">
        <label class="field"><span>Kode kamera</span><input name="code" class="code-in" value="${esc(code)}" maxlength="6" placeholder="K7P2QX" required pattern="[A-Za-z0-9]{6}" autocapitalize="characters" spellcheck="false"></label>
        <label class="field"><span>Kunci (6 angka)</span><input name="key" class="code-in" value="${esc(key)}" maxlength="6" inputmode="numeric" placeholder="••••••" required pattern="\\d{6}"></label>
        <label class="field"><span>Nama kamu</span><input name="name" value="${esc(store.s.parentName)}" maxlength="20" required></label>
        <div id="pair-status">${connectStatus()}</div>
        <button class="btn btn-pri btn-lg" type="submit">${ic('link', 18)} Sambungkan</button>
      </form>
    </div>`;
  },
  mount(root, { c, k }) {
    const form = $('#pair-form', root);
    const go = () => {
      const f = new FormData(form);
      const code = String(f.get('code')).trim().toUpperCase(), secret = String(f.get('key')).trim(), name = String(f.get('name')).trim() || 'Orang tua';
      store.s.parentName = name;
      store.s.pair = { code, secret }; store.save();
      link.join({ code, secret, name });
      $('#pair-status', root).innerHTML = connectStatus();
    };
    form.onsubmit = e => { e.preventDefault(); go(); };
    const off = bus.on('link:state', st => {
      const box = $('#pair-status', root); if (box) box.innerHTML = connectStatus();
      if (st === 'connected' && link.role === 'parent') {
        const first = store.s.mode !== 'parent';
        if (first && store.hasSeed) store.clearSeed();
        store.s.mode = 'parent'; store.s.onboarded = true; store.save();
        applyListen();
        setTimeout(() => { router.go('home', { replace: true }); toast(first ? 'Kamera bayi tersambung. Pemantauan aktif.' : 'Tersambung', { icon: 'checkCircle', tone: 'ok' }); }, 600);
      }
    });
    if (c && k && link.state !== 'connected') go();     // dibuka dari QR → langsung sambungkan
    return off;
  },
});
/* Info bayi dari kamera dipakai di HP orang tua (nama untuk suara alarm, foto) */
bus.on('link:baby', b => {
  if (!b || link.role !== 'parent') return;
  Object.assign(store.s.baby, { name: b.name || store.s.baby.name, birth: b.birth || store.s.baby.birth, gender: b.gender || store.s.baby.gender, photo: b.photo ?? store.s.baby.photo, demo: false });
  store.save();
});

/* ================= Perangkat & mode ================= */
route('devices', {
  render() {
    const s = store.s, mode = s.mode, L = linkLabel();
    const modeCard = (k, icon, title, sub) => `<button class="choice ${mode === k ? 'on' : ''}" data-act="switchMode" data-m="${k}">
      <span class="choice-ic">${ic(icon, 22)}</span><span><b>${title}</b><small>${sub}</small></span>${mode === k ? ic('checkCircle', 20) : ic('chevR', 18)}</button>`;
    let body = '';
    if (mode === 'parent') {
      body = `<div class="card dev">
        <div class="dev-h"><span class="choice-ic tone-accent">${ic('cctv', 24)}</span><div><b>Kamera ${esc(link.baby?.name || s.baby.name)}</b><small class="tone-${L.tone}">${ic(L.icon, 12)} ${L.text}</small></div></div>
        <div class="kv"><span>Kode</span><b class="mono">${esc(s.pair.code || '–')}</b></div>
        ${live.bat != null ? `<div class="kv"><span>Baterai kamera</span><b>${Math.round(live.bat * 100)}%${live.charging ? ' · mengisi' : ''}</b></div>` : ''}
        <div class="kv"><span>Pencahayaan</span><b>${live.dark ? 'Gelap' : 'Terang'}</b></div>
        <div class="btn-row"><button class="btn btn-soft" data-act="reconnect">${ic('rotate', 16)} Sambung ulang</button><button class="btn btn-soft" data-go="connect">${ic('qr', 16)} Ganti kamera</button></div>
      </div>
      ${live.dark ? `<div class="note">${ic('info', 16)} <span>Kamar gelap: gerakan lebih sulit terbaca. Nyalakan lampu tidur redup di dekat boks.</span></div>` : ''}`;
    } else if (mode === 'demo') {
      body = `<div class="card">
        <div class="set-row"><div class="set-main"><b>Pakai kamera & mic perangkat ini</b><small>Uji deteksi tangisan & gerakan sungguhan di satu perangkat</small></div>
          <label class="switch"><input type="checkbox" data-act-change="toggleLocalCam" ${localCam.running ? 'checked' : ''} aria-label="Kamera perangkat ini"><i></i></label></div>
      </div>
      <button class="btn btn-soft btn-lg" data-act="demoPanel">${ic('flask', 18)} Panel simulasi</button>`;
    }
    return `${topbar('Perangkat & koneksi')}
    <div class="stack">
      ${body}
      <div class="sec-h"><h3>Peran HP ini</h3></div>
      <div class="choices">
        ${modeCard('parent', 'phone', 'Monitor orang tua', 'Terima video & alarm dari kamera bayi')}
        ${modeCard('baby', 'cctv', 'Kamera bayi', 'HP ini diletakkan di kamar bayi')}
        ${modeCard('demo', 'flask', 'Mode demo', 'Bayi simulasi untuk mencoba fitur')}
      </div>
      <div class="note">${ic('info', 16)} <span>Agar alarm tetap berbunyi, biarkan aplikasi terbuka di HP orang tua (pakai <b>Mode tidur</b> — layar redup & tetap menyala). Browser HP membatasi suara saat aplikasi ditutup.</span></div>
    </div>`;
  },
  mount() {
    const offs = [bus.on('link:state', () => router.refresh()), bus.on('source', () => router.refresh())];
    const onChange = e => { const el = e.target.closest('[data-act-change]'); if (el) actions[el.dataset.actChange]?.(el); };
    document.addEventListener('change', onChange);
    return () => { offs.forEach(f => f()); document.removeEventListener('change', onChange); };
  },
});
actions.switchMode = async el => {
  const m = el.dataset.m, cur = store.s.mode;
  if (m === cur) { if (m === 'baby') router.go('babycam'); return; }
  if (m === 'parent') { router.go('connect'); return; }
  if (m === 'baby') { router.go('babycam'); return; }
  if (cur !== 'demo' && !await confirmBox('Pindah ke mode demo?', cur === 'parent' ? 'Sambungan ke kamera bayi akan diputus.' : 'HP ini berhenti menjadi kamera bayi.', 'Pindah')) return;
  actions.startDemo();
};
actions.reconnect = () => { const p = store.s.pair; if (p.code) link.join({ code: p.code, secret: p.secret, name: store.s.parentName }); toast('Menyambungkan ulang…', { icon: 'link' }); };
actions.toggleLocalCam = async el => {
  if (el.checked) {
    try {
      await localCam.start({ facing: 'user' });
      bus.emit('localcam');
      toast('Kamera & mikrofon perangkat ini aktif', { icon: 'camera', tone: 'ok' });
    } catch {
      el.checked = false;
      toast('Izin kamera/mikrofon ditolak', { icon: 'alert', tone: 'warn' });
    }
  } else {
    localCam.stop(); bus.emit('localcam');
    toast('Kembali ke bayi simulasi', { icon: 'flask' });
  }
  applyListen();
};

/* ================= Panel simulasi (mode demo) ================= */
export function demoPanelHtml() {
  const sw = (key, label, on) => `<div class="set-row"><div class="set-main"><b>${label}</b></div><label class="switch"><input type="checkbox" data-demo="${key}" ${on ? 'checked' : ''}><i></i></label></div>`;
  return `<div class="demo-panel">
    <h3 class="sheet-title">${ic('flask', 20)} Panel simulasi</h3>
    <p class="muted small">Ubah kondisi bayi simulasi untuk mencoba alarm & fitur.${localCam.running ? ' <b>Kamera asli sedang aktif — matikan untuk memakai bayi simulasi.</b>' : ''}</p>
    <div class="sim-grid">${Object.entries(SIM_STATES).map(([k, v]) => `<button class="sim-btn tone-${v.tone} ${sim.state === k ? 'on' : ''}" data-act="simSet" data-k="${k}">${ic(v.icon, 18)}<span>${v.label}</span></button>`).join('')}</div>
    <div class="card flat">
      ${sw('camOnline', 'Kamera online', sim.camOnline)}
      ${sw('hotRoom', 'Kamar panas (>29°C)', sim.hotRoom)}
      ${sw('auto', 'Demo otomatis', autoDemo.on)}
    </div>
    <p class="fine">Status sekarang: <b>${STATUS[live.status]?.text || '-'}</b></p>
    <button class="btn btn-soft" data-act="resetDemo">${ic('rotate', 16)} Reset semua data</button>
  </div>`;
}
actions.demoPanel = () => sheet(demoPanelHtml(), {
  onMount: root => {
    const onCh = e => {
      const el = e.target.closest('[data-demo]'); if (!el) return;
      if (el.dataset.demo === 'camOnline') sim.setCamera(el.checked);
      if (el.dataset.demo === 'hotRoom') sim.hotRoom = el.checked;
      if (el.dataset.demo === 'auto') autoDemo.set(el.checked);
    };
    root.addEventListener('change', onCh);
    const off = bus.on('sim', () => $$('.sim-btn', root).forEach(b => b.classList.toggle('on', b.dataset.k === sim.state)));
    return off;
  },
});
actions.simSet = el => {
  if (localCam.running) { toast('Matikan kamera perangkat ini dulu', { icon: 'info' }); return; }
  sim.set(el.dataset.k);
  if (window.innerWidth < 1000) closeSheet();
};
actions.resetDemo = async () => {
  if (!await confirmBox('Reset semua data?', 'Profil, jurnal, pengaturan, dan pairing di perangkat ini akan dihapus.', 'Reset', true)) return;
  babyUnit.stop(); link.leave(); localCam.stop(); autoDemo.set(false); sim.set('sleep');
  store.reset();
  closeSheet();
  location.hash = '#/welcome';
  location.reload();
};
