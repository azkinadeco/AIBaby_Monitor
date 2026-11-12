/* KLIP KEJADIAN — "tadi kenapa nangis?"
   Perekam berjalan di HP orang tua dalam potongan 10 detik (hanya potongan terakhir disimpan di memori).
   Saat peringatan muncul: potongan sebelumnya + yang sedang berjalan (≤ 20 dtk sebelum) + 10 dtk sesudah
   disimpan ke IndexedDB di perangkat ini. Tidak ada video yang diunggah ke mana pun. */
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { live, localCam } from './monitor.js';
import { simCam } from './sim.js';
import { link } from './link.js';

const SEG_MS = 10000, POST_MS = 10000, MAX_CLIPS = 30;
const MIME = window.MediaRecorder ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) : null;

let stream = null, rec = null, prevSeg = null, segTimer = null, saving = false, simStream = null, releaseSim = null;

/* ---------------- IndexedDB kecil ---------------- */
let dbP = null;
const db = () => (dbP ||= new Promise((res, rej) => {
  const r = indexedDB.open('aibm-clips', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('clips', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('clips', mode), req = fn(t.objectStore('clips'));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}
export const getClip = id => tx('readonly', s => s.get(id)).catch(() => null);
export async function deleteClip(id) {
  store.s.clips = (store.s.clips || []).filter(x => x !== id);
  store.save();
  await tx('readwrite', s => s.delete(id)).catch(() => {});
}
async function saveClip(ev, parts) {
  const blobs = parts.filter(b => b && b.size > 2000);
  if (!blobs.length) return;
  await tx('readwrite', s => s.put({ id: ev.id, ts: ev.ts, type: ev.type, mime: blobs[0].type, parts: blobs })).catch(() => null);
  const e = store.s.events.find(x => x.id === ev.id);
  if (e) e.clip = true;
  store.s.clips = [ev.id, ...(store.s.clips || []).filter(x => x !== ev.id)];
  // simpan maksimal 30 klip terbaru
  for (const old of store.s.clips.splice(MAX_CLIPS)) {
    await tx('readwrite', s => s.delete(old)).catch(() => {});
    const oe = store.s.events.find(x => x.id === old); if (oe) delete oe.clip;
  }
  store.save();
  bus.emit('clip', ev.id);
}

/* ---------------- Perekaman berputar ---------------- */
const enabled = () => !!MIME && store.s.settings.clips !== false && store.s.mode !== 'baby';

function currentStream() {
  if (live.source === 'sim') return (simStream ||= simCam.canvas.captureStream?.(15) || null);
  if (live.source === 'local') return localCam.stream;
  return link.remoteStream;
}

function startSeg() {
  if (!stream || !stream.getVideoTracks().some(t => t.readyState === 'live')) { rec = null; return; }
  try {
    const chunks = [];
    const mr = new MediaRecorder(stream, { mimeType: MIME, videoBitsPerSecond: 500000, audioBitsPerSecond: 32000 });
    let done;
    const stopped = new Promise(r => { done = r; });
    mr.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    mr.onstop = () => done(new Blob(chunks, { type: mr.mimeType || MIME }));
    mr.start(1000);
    rec = { mr, stopped };
    segTimer = setTimeout(rotate, SEG_MS);
  } catch { rec = null; }
}
function stopSeg() {
  clearTimeout(segTimer);
  const r = rec; rec = null;
  if (!r || r.mr.state === 'inactive') return Promise.resolve(null);
  r.mr.stop();
  return r.stopped;
}
async function rotate() {
  if (saving) return;
  prevSeg = await stopSeg();
  startSeg();
}

export function restartRecorder() {
  stopSeg(); prevSeg = null;
  releaseSim?.(); releaseSim = null;
  stream = enabled() ? currentStream() : null;
  if (!stream) return;
  if (live.source === 'sim') releaseSim = simCam.hold();
  startSeg();
}

async function capture(ev) {
  if (!enabled() || saving || !rec || ['link', 'battery'].includes(ev.type) || ev.level === 'info') return;
  saving = true;
  const cur = await stopSeg();
  const pre = [prevSeg, cur];
  prevSeg = null;
  startSeg();                               // rekam 10 detik sesudah kejadian
  clearTimeout(segTimer);
  segTimer = setTimeout(async () => {
    const post = await stopSeg();
    await saveClip(ev, [...pre, post]);
    saving = false;
    startSeg();
  }, POST_MS);
}

bus.on('alert', capture);
['source', 'link:stream', 'localcam'].forEach(ev => bus.on(ev, () => { if (!saving) restartRecorder(); }));
bus.on('store', path => { if (path === 'settings.clips') restartRecorder(); });

export const clipsSupported = () => !!MIME;
export function startClips() { restartRecorder(); }
