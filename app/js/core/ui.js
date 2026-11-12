/* Komponen UI bersama: toast, bottom sheet, konfirmasi, tema, dan delegasi klik (data-act / data-go). */
import { $, $$, esc, isNightHour, vibrate } from './util.js';
import { ic } from './icons.js';
import { store } from './store.js';
import { router } from './router.js';
import { bus } from './bus.js';

/* ---------------- Aksi (event delegation) ----------------
   <button data-act="namaAksi"> memanggil actions.namaAksi(el, event)
   <button data-go="journal?tab=care"> berpindah layar                      */
export const actions = {};

document.addEventListener('click', e => {
  bus.emit('gesture');
  const go = e.target.closest('[data-go]');
  if (go) {
    e.preventDefault();
    if (go.closest('.sheet-wrap')) closeSheet();
    router.go(go.dataset.go, { replace: go.hasAttribute('data-replace') });
    return;
  }
  const a = e.target.closest('[data-act]');
  if (a && actions[a.dataset.act]) {
    e.preventDefault();
    actions[a.dataset.act](a, e);
  }
});

/* Input yang langsung tersimpan: <input data-set="settings.theme"> */
document.addEventListener('change', e => {
  const el = e.target.closest('[data-set]');
  if (!el) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num !== undefined) v = Number(v);
  store.set(el.dataset.set, v);
  if (el.dataset.after) actions[el.dataset.after]?.(el);
});
document.addEventListener('input', e => {
  const el = e.target.closest('input[type=range][data-out]');
  if (el) { const out = $(el.dataset.out); if (out) out.textContent = el.value + (el.dataset.unit || ''); }
});

actions.back = () => router.back();
actions.closeSheet = () => closeSheet();

/* ---------------- Toast ---------------- */
/** action = { label, fn } → tombol kecil di toast (mis. "Urungkan") */
export function toast(msg, { icon = 'checkCircle', tone = '', ms = 2600, action = null } = {}) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${tone ? 't-' + tone : ''}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `${ic(icon, 18)}<span>${msg}</span>${action ? `<button class="toast-act">${esc(action.label)}</button>` : ''}`;
  const hide = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); };
  if (action) el.querySelector('.toast-act').onclick = () => { action.fn(); hide(); };
  root.appendChild(el);
  while (root.children.length > 3) root.firstChild.remove();
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(hide, action ? Math.max(ms, 5000) : ms);
}

/* ---------------- Bottom sheet ---------------- */
let sheetCleanup = null;
export function sheet(html, { onMount, cls = '' } = {}) {
  closeSheet(true);
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="sheet-bg" data-act="closeSheet"></div>
    <div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
  $('#overlay-root').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  dragToClose(el.querySelector('.sheet'));
  sheetCleanup = onMount?.(el) || null;
  return el;
}
/** Tarik sheet ke bawah (dari pegangan / bagian atas) untuk menutup */
function dragToClose(sh) {
  let y0 = null, dy = 0;
  sh.addEventListener('pointerdown', e => {
    const top = e.clientY - sh.getBoundingClientRect().top;
    if (top > 56 || e.target.closest('input, select, textarea, button, [data-talk]')) return;
    y0 = e.clientY; dy = 0; sh.style.transition = 'none'; sh.setPointerCapture(e.pointerId);
  });
  sh.addEventListener('pointermove', e => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    sh.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 == null) return;
    y0 = null; sh.style.transition = ''; sh.style.transform = '';
    if (dy > 90) closeSheet();
  };
  sh.addEventListener('pointerup', end);
  sh.addEventListener('pointercancel', end);
}

export function closeSheet(instant = false) {
  try { sheetCleanup?.(); } catch { /* */ }
  sheetCleanup = null;
  $$('.sheet-wrap').forEach(el => {
    el.classList.remove('in');
    if (instant) el.remove(); else setTimeout(() => el.remove(), 260);
  });
}

export function confirmBox(title, msg, okLabel = 'Ya', danger = false) {
  return new Promise(res => {
    sheet(`<h3 class="sheet-title">${title}</h3><p class="muted">${msg}</p>
      <div class="btn-row"><button class="btn btn-soft" data-r="0">Batal</button><button class="btn ${danger ? 'btn-bad' : 'btn-pri'}" data-r="1">${okLabel}</button></div>`,
    { onMount: el => $$('[data-r]', el).forEach(b => { b.onclick = () => { closeSheet(); res(b.dataset.r === '1'); }; }) });
  });
}

/* ---------------- Potongan HTML yang sering dipakai ---------------- */
export function topbar(title, { back = true, right = '', sub = '' } = {}) {
  return `<header class="bar">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Kembali">${ic('chevL', 22)}</button>` : '<span class="bar-sp"></span>'}
    <div class="bar-t"><h1>${title}</h1>${sub ? `<small>${sub}</small>` : ''}</div>
    ${right || '<span class="bar-sp"></span>'}
  </header>`;
}
export function toggle(path, checked, { after = '', label = '' } = {}) {
  return `<label class="switch"><input type="checkbox" data-set="${path}" ${checked ? 'checked' : ''} ${after ? `data-after="${after}"` : ''} ${label ? `aria-label="${esc(label)}"` : ''}><i></i></label>`;
}
let segN = 0;
export function seg(path, options, value, { after = '', num = false } = {}) {
  const name = 'seg' + (++segN);
  return `<div class="seg">${options.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" data-set="${path}" ${num ? 'data-num' : ''} ${String(v) === String(value) ? 'checked' : ''} ${after ? `data-after="${after}"` : ''}><span>${l}</span></label>`).join('')}</div>`;
}
export const empty = (icon, text) => `<div class="empty">${ic(icon, 36)}<p>${text}</p></div>`;
export const disclaimer = () => `<p class="fine center">${ic('info', 12)} Alat bantu pemantauan — bukan pengganti pengawasan orang tua dan bukan alat medis.</p>`;

export function babyAvatar(size = 44) {
  const p = store.s.baby.photo;
  return `<span class="baby-av" style="--s:${size}px">${p ? `<img src="${p}" alt="">` : ic('baby', Math.round(size * .55))}</span>`;
}

/* ---------------- Tema ----------------
   auto = gelap pukul 18.00–06.00 (pas untuk memantau malam hari) */
export function applyTheme() {
  const t = store.s.settings.theme || 'auto';
  const dark = t === 'dark' || (t === 'auto' && isNightHour());
  const theme = dark ? 'dark' : 'light';
  if (document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme;
  const meta = $('meta[name=theme-color]');
  if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--bg').trim() || (dark ? '#0B0D1A' : '#F7F4EE');
}
setInterval(applyTheme, 60000);

/* Getar singkat saat tombol diketuk */
document.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .tap') && store.s.settings.alarm.vibrate) vibrate(6);
}, { passive: true });
