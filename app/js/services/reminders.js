/* PENGINGAT MENYUSU — dicek tiap 30 detik, sekali per catatan susu.
   Bukan alarm darurat: cukup toast + getar + suara lembut (tidak saat jam tenang). */
import { store } from '../core/store.js';
import { fmtAgo, vibrate } from '../core/util.js';
import { toast } from '../core/ui.js';
import { speak } from './audio.js';
import { nextFeed } from './insights.js';
import { systemNotify, quietNow } from './alarm.js';

function check() {
  if (store.s.mode === 'baby') return;
  const f = nextFeed();
  // lewati catatan yang sudah sangat lama (mis. data lama/lupa mencatat) agar tidak mengganggu
  if (!f?.due || store.s.feedRemindedFor === f.last.id || Date.now() - f.at > 2 * 3600000) return;
  store.s.feedRemindedFor = f.last.id; store.save();
  const name = store.s.baby.name;
  toast(`Waktunya menyusu ${name} — terakhir ${fmtAgo(f.last.ts)}`, { icon: 'bottle', tone: 'info', ms: 6000 });
  if (store.s.settings.alarm.vibrate) vibrate([200, 100, 200]);
  if (store.s.settings.alarm.voice && !quietNow()) speak(`Pengingat. Sudah waktunya ${name} menyusu.`, .7);
  systemNotify(`Waktunya menyusu · ${name}`, `Susu terakhir ${fmtAgo(f.last.ts)}.`, { tag: 'feed' });
}

export function startReminders() {
  setInterval(check, 30000);
  setTimeout(check, 5000);
}
