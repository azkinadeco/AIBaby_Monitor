/* LIVE — lihat & dengar kamar bayi, bicara, putar penenang, foto/rekam. */
import { $, esc, download, pad2 } from '../core/util.js';
import { ic } from '../core/icons.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { route } from '../core/router.js';
import { actions, toast } from '../core/ui.js';
import { live, snapshot, setArmed, localCam } from '../services/monitor.js';
import { mountFeed } from '../services/feed.js';
import { control, setListen } from '../services/control.js';
import { simCam } from '../services/sim.js';
import { link } from '../services/link.js';
import { statusNow, vitalChips, talkButtonHtml, bindTalk, linkLabel } from './shared.js';

let rec = null;   // { mr, chunks, t0, timer }

function statusPill() {
  const S = statusNow();
  return `<span class="tone-${S.tone}">${ic(S.icon, 15)}</span><b>${S.text}</b>`;
}
function controls() {
  const l = control.lullState(), listen = store.s.listen;
  return `<button class="lc ${listen ? 'on' : ''}" data-act="liveListen"><span>${ic(listen ? 'volume' : 'volumeX', 22)}</span><small>Dengar</small></button>
    ${talkButtonHtml(true)}
    <button class="lc ${l.on ? 'on' : ''}" data-act="lullaby"><span>${ic('music', 22)}</span><small>Lagu</small></button>`;
}
function tools() {
  const t = (act, icon, label, on = false, word = label) => `<button class="tool ${on ? 'on' : ''}" data-act="${act}" title="${label}" aria-label="${label}"><span>${ic(icon, 20)}</span><small>${word}</small></button>`;
  return t('livePhoto', 'camera', 'Foto')
    + t('liveRec', rec ? 'stop' : 'record', rec ? 'Stop rekam' : 'Rekam', !!rec, rec ? 'Stop' : 'Rekam')
    + (live.source === 'sim' ? t('liveNight', 'moon', 'Inframerah', simCam.night, 'Malam') : '')
    + (live.source === 'local' ? t('liveFlip', 'flip', 'Balik kamera', false, 'Balik') : '')
    + t('liveArm', store.s.armed === false ? 'play' : 'pause', store.s.armed === false ? 'Aktifkan AI' : 'Jeda AI', store.s.armed === false, store.s.armed === false ? 'Aktifkan' : 'Jeda')
    + t('livePip', 'copy', 'Jendela mengambang', false, 'Melayang')
    + t('liveFull', 'maximize', 'Layar penuh', false, 'Penuh');
}

route('live', {
  tab: 'live',
  render() {
    const L = linkLabel();
    const cam = store.s.mode === 'parent' ? (link.baby?.name ? `Kamar ${esc(link.baby.name)}` : 'Kamera bayi') : live.source === 'local' ? 'Kamera perangkat ini' : 'Kamera demo';
    return `
    <header class="bar">
      <span class="bar-sp"></span>
      <div class="bar-t"><h1>${cam} <span class="tone-${L.tone} link-ic" id="live-link" title="${L.text}">${ic(L.icon, 14)}</span></h1></div>
      <button class="icon-btn" data-go="devices" aria-label="Perangkat">${ic('settings', 20)}</button>
    </header>
    <div class="live-view" id="live-view">
      <div class="lv-top"><span class="live-tag"><i></i>LIVE</span>${rec ? `<span class="rec-tag"><i></i><span id="rec-time">00:00</span></span>` : ''}</div>
      <div class="lv-nosig">${ic('wifiOff', 30)}<b>Menunggu gambar…</b></div>
      <div class="lv-bottom"><div class="lv-status" id="live-status">${statusPill()}</div><div class="hc-chips" id="live-vit">${vitalChips()}</div></div>
    </div>
    <div class="live-ctl" id="live-ctl">${controls()}</div>
    <div class="tools" id="live-tools">${tools()}</div>
`;
  },
  mount(root) {
    const view = $('#live-view', root);
    const feedOff = mountFeed(view);
    const talkOff = bindTalk(root);
    const set = (id, html) => { const el = $(id, root); if (el) el.innerHTML = html; };
    const offs = [
      bus.on('tick', () => set('#live-vit', vitalChips())),
      bus.on('status', () => set('#live-status', statusPill())),
      bus.on('armed', () => { set('#live-status', statusPill()); set('#live-tools', tools()); }),
      bus.on('lullaby', () => { set('#live-ctl', controls()); bindTalk($('#live-ctl', root)); }),
      bus.on('listen', () => { set('#live-ctl', controls()); bindTalk($('#live-ctl', root)); }),
      bus.on('link:state', () => { const L = linkLabel(), el = $('#live-link', root); if (el) { el.className = `tone-${L.tone} link-ic`; el.title = L.text; el.innerHTML = ic(L.icon, 14); } }),
    ];
    const recT = setInterval(() => {
      const el = $('#rec-time', root);
      if (el && rec) { const s = Math.floor((Date.now() - rec.t0) / 1000); el.textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; }
    }, 500);
    return () => { feedOff(); talkOff(); offs.forEach(f => f()); clearInterval(recT); };
  },
});

/* ---------------- Aksi ---------------- */
const rerenderTools = () => { const el = $('#live-tools'); if (el) el.innerHTML = tools(); };

actions.liveListen = () => {
  const on = !store.s.listen;
  setListen(on);
  if (on && live.source === 'local') toast('Mode demo: kamera HP ini tidak diputar ulang agar tidak berdengung', { icon: 'info' });
  else toast(on ? 'Mendengarkan kamar bayi' : 'Suara kamar dimatikan', { icon: on ? 'volume' : 'volumeX' });
};
actions.livePhoto = () => {
  const data = snapshot(1280, .92);
  if (!data) { toast('Belum ada gambar', { icon: 'alert', tone: 'warn' }); return; }
  download(data, `${store.s.baby.name.toLowerCase()}-${Date.now()}.jpg`);
  const f = document.createElement('div'); f.className = 'flash'; $('#live-view')?.appendChild(f); setTimeout(() => f.remove(), 400);
  toast('Foto disimpan', { icon: 'camera' });
};
actions.liveRec = () => {
  if (rec) {
    rec.mr.state !== 'inactive' && rec.mr.stop();
    return;
  }
  const stream = live.source === 'sim' ? simCam.canvas.captureStream?.(20) : live.source === 'local' ? localCam.stream : link.remoteStream;
  if (!stream || !('MediaRecorder' in window)) { toast('Perekaman tidak didukung di browser ini', { icon: 'alert', tone: 'warn' }); return; }
  const mime = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported?.(m)) || '';
  try {
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    mr.ondataavailable = e => e.data?.size && chunks.push(e.data);
    mr.onstop = () => {
      const type = mr.mimeType || 'video/webm';
      download(new Blob(chunks, { type }), `rekaman-${store.s.baby.name.toLowerCase()}-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
      rec = null; rerenderTools(); $('.rec-tag')?.remove();
      toast('Rekaman disimpan', { icon: 'download', tone: 'ok' });
    };
    mr.start(500);
    rec = { mr, chunks, t0: Date.now() };
    rerenderTools();
    $('.lv-top')?.insertAdjacentHTML('beforeend', '<span class="rec-tag"><i></i><span id="rec-time">00:00</span></span>');
    toast('Merekam… ketuk Stop untuk menyimpan', { icon: 'record', tone: 'bad' });
  } catch { toast('Gagal memulai perekaman', { icon: 'alert', tone: 'warn' }); }
};
actions.liveNight = () => {
  store.set('settings.nightVision', simCam.night ? 'off' : 'on');
  simCam.night = !simCam.night;
  rerenderTools();
};
actions.liveFlip = async () => { await localCam.flip(); bus.emit('localcam'); };
actions.liveArm = () => {
  const on = store.s.armed === false;
  setArmed(on);
  toast(on ? 'Pemantauan AI aktif' : 'Pemantauan dijeda — alarm otomatis mati', { icon: on ? 'shield' : 'pause', tone: on ? 'ok' : 'warn' });
};
actions.liveFull = () => {
  const v = $('#live-view');
  if (!v) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else if (v.requestFullscreen) v.requestFullscreen().catch(() => v.classList.toggle('fs'));
  else v.classList.toggle('fs');
};
let pipVideo = null;
actions.livePip = async () => {
  try {
    if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
    let v = $('#live-view video.feed');
    if (!v) {
      pipVideo ||= Object.assign(document.createElement('video'), { muted: true, playsInline: true });
      pipVideo.srcObject = simCam.canvas.captureStream(20);
      await pipVideo.play();
      v = pipVideo;
    }
    if (!v.requestPictureInPicture) throw new Error('unsupported');
    await v.requestPictureInPicture();
    toast('Jendela mengambang aktif — bisa sambil buka aplikasi lain', { icon: 'copy', tone: 'ok' });
  } catch { toast('Browser ini belum mendukung jendela mengambang', { icon: 'info', tone: 'warn' }); }
};
