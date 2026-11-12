/* LAYAR KAMERA BAYI — tampil di HP yang diletakkan di kamar bayi. */
import { $, esc, fmtTime, loadScript } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route, router } from '../core/router.js';
import { actions, toast, confirmBox, topbar } from '../core/ui.js';
import { babyUnit, pairInfo, pairUrl } from '../services/babyUnit.js';
import { link } from '../services/link.js';
import { live, localCam } from '../services/monitor.js';
import { mountFeed } from '../services/feed.js';
import { TRACKS, lullState, audioReady } from '../services/audio.js';
import { statusNow, soundWord, moveWord } from './shared.js';

const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
let facing = 'environment', dimTimer = null;

const STATE = {
  starting: ['link', 'Menyiapkan…', 'muted'],
  ready: ['radio', 'Siap — menunggu HP orang tua', 'ok'],
  taken: ['rotate', 'Kode sedang dipakai sesi lama, mencoba lagi…', 'warn'],
  error: ['wifiOff', 'Tidak tersambung ke internet, mencoba lagi…', 'bad'],
  idle: ['power', 'Belum aktif', 'muted'],
};

let showPair = false;
function pairHtml() {
  const list = [...link.parents.values()];
  const parents = list.length ? `<div class="bc-par">
      <span class="bc-par-ic">${ic('phone', 18)}</span>
      <span class="bc-par-t"><b>${list.map(p => esc(p.name)).join(', ')}</b><small>${list.length} HP orang tua tersambung</small></span>
      <button class="chip-btn" data-act="bcTogglePair">${ic(showPair ? 'x' : 'plus', 14)} ${showPair ? 'Tutup' : 'Tambah'}</button></div>` : '';
  if (list.length && !showPair) return parents;
  const p = pairInfo();
  return `${parents}<div class="card pair">
    <div class="qr" id="bc-qr" aria-label="Kode QR pairing"></div>
    <div class="pair-t">
      <small>Pindai dari HP orang tua</small>
      <div class="kv"><span>Kode</span><b class="code">${p.code.slice(0, 3)} ${p.code.slice(3)}</b></div>
      <div class="kv"><span>Kunci</span><b class="code">${p.secret.slice(0, 3)} ${p.secret.slice(3)}</b></div>
      <div class="pair-acts"><button class="btn btn-soft btn-sm" data-act="bcCopy">${ic('copy', 14)} Salin</button><button class="icon-btn sm" data-act="bcNewCode" aria-label="Buat kode baru" title="Buat kode baru">${ic('key', 16)}</button></div>
    </div>
  </div>`;
}
function drawQr(root) {
  const box = $('#bc-qr', root); if (!box) return;
  loadScript(QR_LIB).then(() => {
    const qr = window.qrcode(0, 'M'); qr.addData(pairUrl()); qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }).catch(() => { box.innerHTML = `<small class="muted">QR butuh internet. Pakai kode di samping.</small>`; });
}
function statusHtml() {
  const [icn, txt, tone] = STATE[link.state] || STATE.idle;
  return `<span class="tone-${tone}">${ic(icn, 14)}</span> ${txt}`;
}
function vitalsHtml() {
  const S = statusNow(), ls = lullState(), l = ls.on ? TRACKS[ls.track] : null;
  return `<span class="pill tone-${S.tone}">${ic(S.icon, 13)} ${S.text}</span>
    <span class="pill">${ic('volume', 13)} ${soundWord(live.level, live.cry)}</span>
    <span class="pill">${ic('move', 13)} ${moveWord(live.motion)}</span>${l ? `<span class="pill on">${ic('music', 13)} ${l.name}</span>` : ''}`;
}

const audioNote = () => (audioReady() ? '' : `<button class="banner warn" data-act="bcWakeAudio">${ic('volumeX', 18)}<span><b>Ketuk untuk aktifkan suara</b><small>Deteksi tangisan belum berjalan</small></span></button>`);

route('babycam', {
  dark: true,
  render() {
    if (!babyUnit.running) {
      return `${topbar('Kamera bayi')}
      <div class="stack">
        <div class="bc-ill" aria-hidden="true">
          <div class="wl-sky"><i></i><i></i><i></i><i></i><i></i></div>
          <span class="bc-phone">${ic('cctv', 26)}</span><span class="bc-cone"></span><span class="bc-crib">${ic('baby', 30)}</span>
        </div>
        <div class="bc-tips"><span>${ic('ruler', 14)} ±1 m dari boks</span><span>${ic('bolt', 14)} Dicas</span><span>${ic('moon', 14)} Lampu redup</span></div>
        <form class="form" id="bc-form">
          <label class="field"><span>Nama bayi</span><input name="name" value="${store.s.baby.demo ? '' : esc(store.s.baby.name)}" placeholder="cth. Aisyah" maxlength="20" required></label>
          <div class="field"><span>Kamera</span><div class="seg">
            <label><input type="radio" name="facing" value="environment" ${facing === 'environment' ? 'checked' : ''}><span>Belakang</span></label>
            <label><input type="radio" name="facing" value="user" ${facing === 'user' ? 'checked' : ''}><span>Depan</span></label></div></div>
          <button class="btn btn-pri btn-lg" type="submit">${ic('play', 18)} Mulai kamera</button>
        </form>
      </div>`;
    }
    return `<header class="bar"><span class="bar-sp"></span><div class="bar-t"><h1>Kamera ${esc(store.s.baby.name)}</h1><small id="bc-state">${statusHtml()}</small></div>
      <button class="icon-btn" data-act="bcDim" aria-label="Redupkan layar">${ic('moon', 20)}</button></header>
    <div class="stack">
      <div class="bc-preview" id="bc-preview"><span class="live-tag"><i></i>MENGIRIM</span></div>
      <div id="bc-audio">${audioNote()}</div>
      <div class="bc-vitals" id="bc-vitals">${vitalsHtml()}</div>
      <div id="bc-pair">${pairHtml()}</div>
      <div class="btn-row">
        <button class="btn btn-soft" data-act="bcFlip">${ic('flip', 16)} Balik kamera</button>
        <button class="btn btn-soft danger" data-act="bcStop">${ic('power', 16)} Berhenti</button>
      </div>
    </div>`;
  },
  mount(root) {
    if (!babyUnit.running) {
      $('#bc-form', root).onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        facing = f.get('facing');
        if (store.hasSeed) store.clearSeed();
        store.s.baby.name = String(f.get('name')).trim() || 'Si Kecil';
        store.s.onboarded = true;
        store.save();
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Meminta izin kamera…';
        try {
          await babyUnit.start(facing);
          router.refresh();
        } catch (err) {
          btn.disabled = false; btn.innerHTML = `${ic('play', 18)} Coba lagi`;
          toast(err?.name === 'NotAllowedError' ? 'Izin kamera/mikrofon ditolak. Izinkan di pengaturan browser.' : 'Kamera tidak bisa dibuka', { icon: 'alert', tone: 'bad', ms: 4500 });
        }
      };
      return null;
    }
    const feedOff = mountFeed($('#bc-preview', root));
    drawQr(root);
    const set = (id, html) => { const el = $(id, root); if (el) el.innerHTML = html; };
    const offs = [
      bus.on('link:state', () => set('#bc-state', statusHtml())),
      bus.on('link:parents', () => { if (!link.parents.size) showPair = false; set('#bc-pair', pairHtml()); drawQr(root); scheduleDim(); }),
      bus.on('tick', () => set('#bc-vitals', vitalsHtml())),
      bus.on('lullaby', () => set('#bc-vitals', vitalsHtml())),
      bus.on('gesture', () => setTimeout(() => set('#bc-audio', audioNote()), 300)),
      bus.on('babycam:cmd', m => toast(`${esc(m.from)}: ${m.a === 'lull' ? 'memutar penenang' : m.a === 'say' ? `“${esc(m.text)}”` : m.a === 'lullStop' ? 'menghentikan penenang' : 'mengatur volume'}`, { icon: 'phone' })),
    ];
    scheduleDim();
    return () => { feedOff(); offs.forEach(f => f()); clearTimeout(dimTimer); undim(); };
  },
});

/* ---------- Layar redup (hemat baterai, tidak mengganggu bayi) ---------- */
function scheduleDim() {
  clearTimeout(dimTimer);
  if (store.s.settings.babyDim && link.parents.size) dimTimer = setTimeout(dim, 45000);
}
function dim() {
  if (document.getElementById('dim') || router.current.name !== 'babycam') return;
  const el = document.createElement('button');
  el.id = 'dim'; el.className = 'dim';
  el.innerHTML = `<i class="dim-dot"></i><span>Kamera aktif · ${link.parents.size} orang tua · <b id="dim-clock">${fmtTime(Date.now())}</b></span><small>Ketuk untuk membuka</small>`;
  el.onclick = () => { undim(); scheduleDim(); };
  document.getElementById('overlay-root').appendChild(el);
  const t = setInterval(() => { const c = document.getElementById('dim-clock'); if (c) c.textContent = fmtTime(Date.now()); else clearInterval(t); }, 30000);
}
function undim() { document.getElementById('dim')?.remove(); }

actions.bcDim = () => dim();
actions.bcTogglePair = () => { showPair = !showPair; const el = $('#bc-pair'); if (el) { el.innerHTML = pairHtml(); drawQr(el); } };
actions.bcWakeAudio = () => toast('Suara aktif — deteksi tangisan berjalan', { icon: 'volume', tone: 'ok' });
actions.bcFlip = async () => { await babyUnit.flip(); facing = localCam.facing; };
actions.bcCopy = async () => {
  try { await navigator.clipboard.writeText(pairUrl()); toast('Tautan disalin — kirim ke HP orang tua', { icon: 'copy', tone: 'ok' }); }
  catch { toast(pairUrl(), { icon: 'link', ms: 6000 }); }
};
actions.bcStop = async () => {
  if (!await confirmBox('Berhenti jadi kamera?', 'HP orang tua tidak akan menerima video & alarm lagi.', 'Berhenti', true)) return;
  babyUnit.stop();
  router.refresh();
};
actions.bcNewCode = async () => {
  if (!await confirmBox('Buat kode baru?', 'Semua HP orang tua harus dipasangkan ulang dengan kode baru.', 'Buat kode baru', true)) return;
  await babyUnit.newCode();
  router.refresh();
};
