/* Router berbasis hash (#/home, #/journal?tab=care, #/event/ID).
   Tombol kembali di HP/browser ikut bekerja. Setiap layar boleh mengembalikan fungsi cleanup dari mount(). */
import { $ } from './util.js';
import { bus } from './bus.js';

const routes = {};
let current = { name: '', params: {} };
let cleanup = null;
let guard = () => null;

export function route(name, def) { routes[name] = def; }
export function setGuard(fn) { guard = fn; }

function parse(hash = location.hash) {
  const [path, qs] = hash.replace(/^#\/?/, '').split('?');
  const [name, id] = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  if (id) params.id = decodeURIComponent(id);
  return { name: name || 'home', params };
}

function render({ keepScroll = false } = {}) {
  let next = parse();
  const redirect = guard(next);
  if (redirect && redirect !== next.name) {
    history.replaceState({ n: history.state?.n || 0 }, '', '#/' + redirect);
    next = parse();
  }
  const def = routes[next.name] || routes.home;
  const scr = $('#screen');
  const top = keepScroll ? scr.scrollTop : 0;
  const same = current.name === next.name;
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  current = next;

  document.body.dataset.route = next.name;
  scr.className = 'screen' + (def.dark ? ' is-dark' : '') + (def.tab ? ' has-tabs' : '');
  scr.innerHTML = def.render(next.params);
  scr.scrollTop = top;
  if (!keepScroll && !same) { scr.classList.remove('enter'); void scr.offsetWidth; scr.classList.add('enter'); }
  cleanup = def.mount?.(scr, next.params) || null;
  bus.emit('route', { ...next, tab: def.tab || null, dark: !!def.dark });
}

export const router = {
  get current() { return current; },
  go(path, { replace = false } = {}) {
    const n = (history.state?.n || 0) + (replace ? 0 : 1);
    history[replace ? 'replaceState' : 'pushState']({ n }, '', '#/' + path.replace(/^#?\/?/, ''));
    render();
  },
  back() {
    if ((history.state?.n || 0) > 0) history.back();
    else this.go('home', { replace: true });
  },
  refresh() { render({ keepScroll: true }); },
  start() {
    if (!history.state) history.replaceState({ n: 0 }, '', location.hash || '#/home');
    window.addEventListener('popstate', () => render());
    render();
  },
};
