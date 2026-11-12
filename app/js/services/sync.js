/* JURNAL BERSAMA — catatan perawatan (susu, popok, dll.) disinkronkan ke semua HP orang tua.
   HP kamera bayi menjadi penghubung: menyimpan salinan & meneruskan ke HP lain.
   Tanpa server: hanya lewat sambungan WebRTC yang sudah ada. */
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { DAY } from '../core/util.js';
import { link } from './link.js';

const recent = (days = 7) => store.s.care.filter(c => c.ts > Date.now() - days * DAY).slice(0, 200);
const isParent = () => link.role === 'parent' && link.state === 'connected';
const isBaby = () => link.role === 'baby';

/* ---- HP orang tua ---- */
bus.on('care:add', item => { if (isParent()) link.send({ t: 'care', items: [item] }); });
bus.on('care:del', id => { if (isParent()) link.send({ t: 'care', items: [], deleted: [id] }); });
// baru tersambung: kirim catatan milik HP ini supaya HP lain ikut punya
bus.on('link:baby', () => { if (link.role === 'parent') link.send({ t: 'care', items: recent(), deleted: store.s.careDeleted.slice(0, 100) }); });

/* ---- Pesan masuk (kedua peran) ---- */
bus.on('link:care', m => {
  const items = Array.isArray(m.items) ? m.items.slice(0, 300) : [];
  const deleted = Array.isArray(m.deleted) ? m.deleted.slice(0, 300).map(String) : [];
  const changed = store.mergeCare(items, deleted);
  // kamera bayi meneruskan perubahan ke semua orang tua (termasuk pengirim — penggabungan idempoten)
  if (isBaby() && changed) link.broadcast({ t: 'care', items, deleted });
});

/* ---- HP kamera bayi: orang tua baru tersambung → kirim jurnal lengkap ---- */
bus.on('link:parents', () => {
  if (isBaby()) link.broadcast({ t: 'care', items: recent(), deleted: store.s.careDeleted.slice(0, 100) });
});
