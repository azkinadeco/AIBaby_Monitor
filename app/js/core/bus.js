/* Event bus kecil. on() mengembalikan fungsi untuk berhenti mendengarkan. */
const listeners = new Map();

export const bus = {
  on(ev, fn) {
    if (!listeners.has(ev)) listeners.set(ev, new Set());
    listeners.get(ev).add(fn);
    return () => listeners.get(ev)?.delete(fn);
  },
  emit(ev, data) {
    const set = listeners.get(ev);
    if (!set) return;
    // Iterasi atas salinan: pendengar boleh melepas diri / memasang pendengar baru (mis. layar render ulang)
    // tanpa membuat loop tak berujung. Pendengar yang sudah dilepas di tengah jalan dilewati.
    for (const fn of [...set]) {
      if (!set.has(fn)) continue;
      try { fn(data); } catch (e) { console.error(`[bus:${ev}]`, e); }
    }
  },
};
