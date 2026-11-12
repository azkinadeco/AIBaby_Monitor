/* LAYAR KAMERA BAYI — tampil di HP yang diletakkan di kamar bayi. */
import { $, esc, fmtTime, fmtDur, loadScript } from '../core/util.js';
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

function parentsHtml() {
  const list = [...link.parents.values()];
  if (!list.length) return `<p class="muted small">Belum ada HP orang tua yang tersambung.</p>`;
  return list.map(p => `<span class="chip on">${ic('phone', 13)} ${esc(p.name)} · ${fmtDur(Date.now() - p.since)}</span>`).join('');
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

const audioNote = () => (audioReady() ? '' : `<button class="banner warn" data-act="bcWakeAudio">${ic('volumeX', 18)}<span><b>Ketuk di sini untuk mengaktifkan suara</b><small>Browser menahan mikrofon & speaker sampai layar disentuh — deteksi tangisan belum aktif.</small></span></button>`);

route('babycam', {
  dark: true,
  render() {
    if (!babyUnit.running) {
      return `${topbar('Kamera bayi')}
      <div class="stack">
        <div class="bc-hero">${ic('cctv', 40)}<h2>Kamera bayi</h2></div>
        <div class="card tips">
          <div>${ic('ruler', 16)}<span>1–1,5 m dari boks</span></div>
          <div>${ic('bolt', 16)}<span>Colokkan charger</span></div>
          <div>${ic('moon', 16)}<span>Lampu tidur redup</span></div>
          <div>${ic('shield', 16)}<span>Jauh dari jangkauan bayi</span></div>
        </div>
        <form class="form" id="bc-form">
          <label class="field"><span>Nama bayi</span><input name="name" value="${store.s.baby.demo ? '' : esc(store.s.baby.name)}" placeholder="cth. Aisyah" maxlength="20" required></label>
          <div class="field"><span>Kamera</span><div class="seg">
            <label><input type="radio" name="facing" value="environment" ${facing === 'environment' ? 'checked' : ''}><span>Belakang (lebih jernih)</span></label>
            <label><input type="radio" name="facing" value="user" ${facing === 'user' ? 'checked' : ''}><span>Depan</span></label></div></div>
          <button class="btn btn-pri btn-lg" type="submit">${ic('play', 18)} Mulai kamera</button>
        </form>
      </div>`;
    }
    const p = pairInfo();
    return `<header class="bar"><span class="bar-sp"></span><div class="bar-t"><h1>Kamera ${esc(store.s.baby.name)}</h1><small id="bc-state">${statusHtml()}</small></div>
      <button class="icon-btn" data-act="bcDim" aria-label="Redupkan layar">${ic('moon', 20)}</button></header>
    <div class="stack">
      <div class="bc-preview" id="bc-preview"><span class="live-tag"><i></i>MENGIRIM</span></div>
      <div id="bc-audio">${audioNote()}</div>
      <div class="bc-vitals" id="bc-vitals">${vitalsHtml()}</div>
      <div class="card pair">
        <div class="qr" id="bc-qr" aria-label="Kode QR pairing"></div>
        <div class="pair-t">
          <small>Pindai dari HP orang tua</small>
          <div class="kv"><span>Kode</span><b class="code">${p.code.slice(0, 3)} ${p.code.slice(3)}</b></div>
          <div class="kv"><span>Kunci</span><b class="code">${p.secret.slice(0, 3)} ${p.secret.slice(3)}</b></div>
          <button class="btn btn-soft btn-sm" data-act="bcCopy">${ic('copy', 14)} Salin tautan</button>
        </div>
      </div>
      <div class="sec-h"><h3>HP orang tua</h3></div>
      <div class="chips" id="bc-parents">${parentsHtml()}</div>
      <div class="btn-row">
        <button class="btn btn-soft" data-act="bcFlip">${ic('flip', 16)} Balik kamera</button>
        <button class="btn btn-soft danger" data-act="bcStop">${ic('power', 16)} Berhenti</button>
      </div>
      <button class="btn btn-ghost btn-sm" data-act="bcNewCode">${ic('key', 14)} Buat kode baru (putuskan semua orang tua)</button>
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
    loadScript(QR_LIB).then(() => {
      const qr = window.qrcode(0, 'M'); qr.addData(pairUrl()); qr.make();
      const box = $('#bc-qr', root); if (box) box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    }).catch(() => { const box = $('#bc-qr', root); if (box) box.innerHTML = `<small class="muted">QR butuh internet. Pakai kode di samping.</small>`; });
    const set = (id, html) => { const el = $(id, root); if (el) el.innerHTML = html; };
    const offs = [
      bus.on('link:state', () => set('#bc-state', statusHtml())),
      bus.on('link:parents', () => { set('#bc-parents', parentsHtml()); scheduleDim(); }),
      bus.on('tick', () => set('#bc-vitals', vitalsHtml())),
      bus.on('lullaby', () => set('#bc-vitals', vitalsHtml())),
      bus.on('gesture', () => setTimeout(() => set('#bc-audio', audioNote()), 300)),
      bus.on('babycam:cmd', m => toast(`${esc(m.from)}: ${m.a === 'lull' ? 'memutar penenang' : m.a === 'say' ? `“${esc(m.text)}”` : m.a === 'lullStop' ? 'menghentikan penenang' : 'mengatur volume'}`, { icon: 'phone' })),
    ];
    const t = setInterval(() => set('#bc-parents', parentsHtml()), 30000);
    scheduleDim();
    return () => { feedOff(); offs.forEach(f => f()); clearInterval(t); clearTimeout(dimTimer); undim(); };
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
