/* PEMBUKA, PEMASANGAN (pairing), PERANGKAT, dan PANEL DEMO. */
import { $, $$, esc, loadScript, vibrate } from '../core/util.js';
import { ic, logo } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { actions, sheet, closeSheet, toast, confirmBox, topbar } from '../core/ui.js';
import { link } from '../services/link.js';
import { live, localCam } from '../services/monitor.js';
import { sim, SIM_STATES, autoDemo } from '../services/sim.js';
import { babyUnit } from '../services/babyUnit.js';
import { applyListen } from '../services/control.js';
import { linkLabel } from './shared.js';

/* ================= Pembuka ================= */
route('welcome', {
  render() {
    return `<div class="welcome">
      <div class="wl-hero" aria-hidden="true">
        <div class="wl-sky"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="wl-moon"></div>
        <div class="wl-ill">
          <div class="wl-dev"><span class="wl-scr">${ic('cctv', 26)}</span><small>Kamar bayi</small></div>
          <div class="wl-link"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="wl-dev pri"><span class="wl-scr">${ic('phone', 26)}<em class="wl-ping">${ic('bell', 11)}</em></span><small>Orang tua</small></div>
        </div>
      </div>
      <div class="wl-body">
        <div class="wl-brand">${logo(20)}<b>AI Baby Monitor</b></div>
        <h1>Tidur tenang,<br><em>si kecil terpantau.</em></h1>
        <p class="wl-q">Gunakan HP ini sebagai</p>
        <div class="wl-pick">
          <button class="wl-opt pri" data-go="connect"><span>${ic('phone', 24)}</span><b>Monitor</b><small>untuk orang tua</small></button>
          <button class="wl-opt" data-go="babycam"><span>${ic('cctv', 24)}</span><b>Kamera</b><small>di kamar bayi</small></button>
        </div>
        <button class="wl-demo" data-act="startDemo">${ic('play', 14)} Coba demo dulu</button>
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
      <button class="scan-cta" data-act="scanQr">
        <span class="scan-ic">${ic('qr', 30)}<i></i></span>
        <span><b>Pindai QR</b><small>di layar HP kamera bayi</small></span>${ic('chevR', 18)}
      </button>
      <div class="or"><span>atau ketik kode</span></div>
      <form class="form" id="pair-form" autocomplete="off">
        <div class="pair-in">
          <label class="field"><span>Kode</span><input name="code" class="code-in" value="${esc(code)}" maxlength="6" placeholder="K7P2QX" required pattern="[A-Za-z0-9]{6}" autocapitalize="characters" spellcheck="false"></label>
          <label class="field"><span>Kunci</span><input name="key" class="code-in" value="${esc(key)}" maxlength="6" inputmode="numeric" placeholder="123456" required pattern="\\d{6}"></label>
        </div>
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
/* ---------- Pindai QR di dalam aplikasi ----------
   BarcodeDetector (Chrome/Android) bila ada; selain itu jsQR dari CDN. */
const JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
function parsePair(text) {
  try {
    const u = new URL(text, location.href);
    const q = new URLSearchParams((u.hash.split('?')[1]) || u.search);
    const c = q.get('c'), k = q.get('k');
    if (/^[A-Za-z0-9]{6}$/.test(c || '') && /^\d{6}$/.test(k || '')) return { c: c.toUpperCase(), k };
  } catch { /* bukan URL */ }
  return null;
}
actions.scanQr = () => {
  let stream = null, raf = 0, done = false;
  sheet(`<h3 class="sheet-title">Pindai QR</h3>
    <div class="scan-box"><video playsinline muted></video><i class="scan-frame"></i><p class="scan-msg">Membuka kamera…</p></div>
    <p class="muted small center">Arahkan ke QR di HP kamera bayi</p>`, {
    onMount: root => {
      const video = $('video', root), msg = $('.scan-msg', root);
      const fail = t => { msg.textContent = t; msg.hidden = false; };
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (done) { stream.getTracks().forEach(t => t.stop()); return; }
          video.srcObject = stream; await video.play(); msg.hidden = true;
        } catch (e) { fail(e?.name === 'NotAllowedError' ? 'Izin kamera ditolak. Ketik kodenya saja.' : 'Kamera tidak bisa dibuka. Ketik kodenya saja.'); return; }
        // Tiap frame digambar ke kanvas dulu — lebih andal daripada membaca <video> langsung
        const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
        const grab = () => {
          const w = video.videoWidth, h = video.videoHeight; if (!w) return false;
          const k = Math.min(1, 720 / Math.max(w, h)); cv.width = w * k; cv.height = h * k;
          cx.drawImage(video, 0, 0, cv.width, cv.height); return true;
        };
        let bd = null;
        try { if ((await window.BarcodeDetector?.getSupportedFormats())?.includes('qr_code')) bd = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { /* */ }
        if (!bd) { try { await loadScript(JSQR); } catch { fail('Pemindai butuh internet. Ketik kodenya saja.'); return; } }
        const detect = async () => {
          if (!grab()) return null;
          if (bd) return (await bd.detect(cv))[0]?.rawValue;
          return window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height)?.data;
        };
        let last = 0;
        const loop = async t => {
          if (done) return;
          if (t - last > 220) {
            last = t;
            try {
              const txt = await detect(); const p = txt && parsePair(txt);
              if (p) { vibrate(30); closeSheet(); router.go(`connect?c=${p.c}&k=${p.k}`, { replace: true }); return; }
              if (txt) { msg.textContent = 'Ini bukan QR AI Baby Monitor'; msg.hidden = false; }
            } catch { /* frame belum siap */ }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      })();
      return () => { done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
    },
  });
};

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
      ${live.dark ? `<div class="note">${ic('info', 16)} <span>Kamar gelap — nyalakan lampu tidur redup agar gerakan terbaca.</span></div>` : ''}`;
    } else if (mode === 'demo') {
      body = `<div class="card">
        <div class="set-row"><div class="set-main"><b>Pakai kamera HP ini</b><small>Uji deteksi sungguhan</small></div>
          <label class="switch"><input type="checkbox" data-act-change="toggleLocalCam" ${localCam.running ? 'checked' : ''} aria-label="Kamera perangkat ini"><i></i></label></div>
      </div>
      <button class="btn btn-soft btn-lg" data-act="demoPanel">${ic('flask', 18)} Panel simulasi</button>`;
    }
    return `${topbar('Perangkat & koneksi')}
    <div class="stack">
      ${body}
      <h4 class="grp">Peran HP ini</h4>
      <div class="choices">
        ${modeCard('parent', 'phone', 'Monitor orang tua', 'Terima video & alarm')}
        ${modeCard('baby', 'cctv', 'Kamera bayi', 'Diletakkan di kamar bayi')}
        ${modeCard('demo', 'flask', 'Mode demo', 'Bayi simulasi')}
      </div>
      <div class="note">${ic('info', 16)} <span>Biarkan aplikasi terbuka (<b>Mode tidur</b>) agar alarm tetap berbunyi.</span></div>
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
    <p class="muted small">Ubah kondisi bayi simulasi.${localCam.running ? ' <b>Kamera asli sedang aktif — matikan untuk memakai bayi simulasi.</b>' : ''}</p>
    <div class="sim-grid">${Object.entries(SIM_STATES).map(([k, v]) => `<button class="sim-btn tone-${v.tone} ${sim.state === k ? 'on' : ''}" data-act="simSet" data-k="${k}">${ic(v.icon, 18)}<span>${v.label}</span></button>`).join('')}</div>
    <div class="card flat">
      ${sw('camOnline', 'Kamera online', sim.camOnline)}
      ${sw('hotRoom', 'Kamar panas (>29°C)', sim.hotRoom)}
      ${sw('auto', 'Demo otomatis', autoDemo.on)}
    </div>
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
