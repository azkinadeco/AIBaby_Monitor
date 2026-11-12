/* LAINNYA — profil bayi, pengaturan, kunci aplikasi, bantuan. */
import { $, $$, esc, babyAge, sha256 } from '../core/util.js';
import { ic, logo } from '../core/icons.js';
import { store } from '../core/store.js';
import { route, router } from '../core/router.js';
import { actions, sheet, closeSheet, toast, topbar, toggle, seg, babyAvatar, disclaimer, applyTheme } from '../core/ui.js';
import { TYPES } from '../services/monitor.js';
import { TRACKS, testAlarm } from '../services/audio.js';
import { linkLabel } from './shared.js';

/* ================= Menu ================= */
route('more', {
  tab: 'more',
  render() {
    const s = store.s, L = linkLabel();
    const item = (go, icon, label, sub = '', tone = '') => `<button class="row" ${go.startsWith('act:') ? `data-act="${go.slice(4)}"` : `data-go="${go}"`}>
      <span class="row-ic ${tone}">${ic(icon, 18)}</span><span class="row-main"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>${ic('chevR', 18, 'chev')}</button>`;
    const modeName = { demo: 'Mode demo', parent: 'Monitor orang tua', baby: 'Kamera bayi' }[s.mode];
    return `<header class="top"><h1 class="title">Lainnya</h1></header>
    <div class="stack">
      <button class="card profile" data-go="baby">${babyAvatar(64)}<span><b>${esc(s.baby.name)}</b><small>${babyAge(s.baby.birth)} · ${s.baby.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</small></span>${ic('edit', 18, 'chev')}</button>
      <div class="card list">
        ${item('devices', 'radio', 'Perangkat & koneksi', s.mode === 'demo' ? modeName : `${modeName} · ${L.text}`, 'tone-pri')}
        ${s.mode === 'baby' ? item('babycam', 'cctv', 'Layar kamera bayi', 'Kode pairing & HP orang tua', 'tone-accent') : ''}
        ${item('settings', 'settings', 'Alarm & deteksi', 'Bunyi, sensitivitas, jam tenang', 'tone-warn')}
        ${item('act:pinSheet', 'lock', 'Kunci aplikasi', s.settings.pinHash ? 'Aktif — PIN 4 angka' : 'Nonaktif', 'tone-ok')}
      </div>
      <div class="card list">
        ${item('journal?tab=sleep', 'chart', 'Statistik tidur')}
        ${item('act:exportCsv', 'download', 'Unduh jurnal (CSV)')}
        ${item('act:printReport', 'heart', 'Laporan untuk dokter anak')}
        ${s.mode === 'demo' ? item('act:demoPanel', 'flask', 'Panel simulasi') : ''}
      </div>
      <div class="card list">
        ${item('help', 'help', 'Bantuan & cara pakai')}
        ${item('help?about=1', 'info', 'Tentang aplikasi', 'Versi 3.0')}
      </div>
      ${disclaimer()}
    </div>`;
  },
});

/* ================= Profil bayi ================= */
route('baby', {
  render() {
    const b = store.s.baby;
    return topbar('Profil si kecil') + `<div class="stack">
      <div class="av-edit">${babyAvatar(96)}<button class="mini-btn" data-act="pickPhoto" aria-label="Ganti foto">${ic('camera', 16)}</button><input type="file" id="photo-in" accept="image/*" hidden></div>
      <form class="form" id="baby-form">
        <label class="field"><span>Nama panggilan</span><input name="name" value="${esc(b.name)}" required maxlength="24"></label>
        <label class="field"><span>Tanggal lahir</span><input name="birth" type="date" value="${b.birth}" max="${new Date().toISOString().slice(0, 10)}" required></label>
        <div class="field"><span>Jenis kelamin</span><div class="seg">
          <label><input type="radio" name="gender" value="P" ${b.gender !== 'L' ? 'checked' : ''}><span>Perempuan</span></label>
          <label><input type="radio" name="gender" value="L" ${b.gender === 'L' ? 'checked' : ''}><span>Laki-laki</span></label></div></div>
        <label class="field"><span>Catatan kesehatan (opsional)</span><textarea name="note" rows="2" maxlength="160" placeholder="cth. lahir prematur, refluks">${esc(b.note || '')}</textarea></label>
        <label class="field"><span>Nama kamu (orang tua)</span><input name="parent" value="${esc(store.s.parentName)}" maxlength="20"></label>
        <button class="btn btn-pri btn-lg" type="submit">Simpan</button>
      </form>
    </div>`;
  },
  mount(root) {
    $('#photo-in', root).onchange = e => {
      const file = e.target.files?.[0]; if (!file) return;
      const img = new Image();
      img.onload = () => {
        const cv = Object.assign(document.createElement('canvas'), { width: 192, height: 192 });
        const s = Math.min(img.width, img.height);
        cv.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
        store.set('baby.photo', cv.toDataURL('image/jpeg', .82));
        URL.revokeObjectURL(img.src);
        router.refresh();
      };
      img.src = URL.createObjectURL(file);
    };
    $('#baby-form', root).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      Object.assign(store.s.baby, { name: String(f.get('name')).trim(), birth: f.get('birth'), gender: f.get('gender'), note: String(f.get('note')).trim(), demo: false });
      store.s.parentName = String(f.get('parent')).trim() || store.s.parentName;
      store.set('baby.name', store.s.baby.name);
      toast('Profil disimpan');
      router.back();
    };
  },
});
actions.pickPhoto = () => $('#photo-in')?.click();

/* ================= Pengaturan ================= */
const SENS = ['rendah', 'sedang', 'tinggi'];
function detTile(t, label) {
  const d = store.s.settings.detect[t], lv = SENS.indexOf(d.sens) + 1;
  return `<div class="det-tile ${d.on ? 'on' : ''} lv-${TYPES[t].level}">
    <button class="det-main" data-act="detToggle" data-t="${t}" aria-pressed="${d.on}"><span>${ic(TYPES[t].icon, 20)}</span><b>${label}</b><small>${d.on ? d.sens : 'mati'}</small></button>
    <div class="det-sens" role="group" aria-label="Sensitivitas ${label}">${[1, 2, 3].map(n => `<button data-act="detSens" data-t="${t}" data-v="${n}" class="${d.on && lv >= n ? 'f' : ''}" aria-label="${SENS[n - 1]}"></button>`).join('')}</div>
  </div>`;
}
function opts(path, list, val) {
  return `<div class="opts">${list.map(([v, i, l]) => `<button class="opt ${String(val) === String(v) ? 'on' : ''}" data-act="setOpt" data-path="${path}" data-v="${v}">${ic(i, 20)}<span>${l}</span></button>`).join('')}</div>`;
}
route('settings', {
  render() {
    const S = store.s.settings, A = S.alarm;
    const row = (title, sub, ctl) => `<div class="set-row"><div class="set-main"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${ctl}</div>`;
    return topbar('Alarm & deteksi') + `<div class="stack">
      <div class="sec-h"><h3>${ic('sparkles', 16)} Deteksi</h3><small class="muted">ketuk = on/off · garis = sensitivitas</small></div>
      <div class="det-grid">${detTile('cry', 'Tangisan')}${detTile('motion', 'Gelisah')}${detTile('wake', 'Terbangun')}</div>
      <details class="card more-det"><summary>${ic('flask', 16)} Deteksi lanjutan <small>(mode demo)</small>${ic('chevD', 16)}</summary>
        <p class="muted small">Tengkurap, muntah, dan napas butuh model AI visi khusus di server/gateway (lihat PRD). Saat ini hanya bisa dicoba dengan bayi simulasi.</p>
        <div class="det-grid">${detTile('position', 'Tengkurap')}${detTile('vomit', 'Muntah')}${detTile('breath', 'Napas')}</div>
      </details>

      <div class="sec-h"><h3>${ic('volume', 16)} Bunyi alarm</h3></div>
      ${opts('settings.alarm.sound', [['siren', 'alert', 'Sirene'], ['chime', 'bell', 'Lonceng'], ['voice', 'mic', 'Suara saja']], A.sound)}
      <div class="vol card">${ic('volumeX', 18)}<input type="range" min="20" max="100" step="5" value="${A.volume}" data-set="settings.alarm.volume" data-num data-out="#vol-out" data-unit="%" aria-label="Volume alarm">${ic('volume', 18)}<b id="vol-out">${A.volume}%</b></div>
      <div class="card">
        ${row('Suara peringatan', `“${esc(TYPES.cry.speak(store.s.baby.name))}”`, toggle('settings.alarm.voice', A.voice, { label: 'Suara peringatan' }))}
        ${row('Getar', '', toggle('settings.alarm.vibrate', A.vibrate, { label: 'Getar' }))}
        ${row('Notifikasi sistem', 'Saat aplikasi di latar belakang', toggle('settings.alarm.notify', A.notify, { after: 'askNotify', label: 'Notifikasi' }))}
        ${row('Jam tenang', 'Peringatan ringan tanpa bunyi. Darurat tetap berbunyi.', toggle('settings.alarm.quiet.on', A.quiet.on, { after: 'rerender', label: 'Jam tenang' }))}
        ${A.quiet.on ? `<div class="times">${ic('moon', 16)}<input type="time" value="${A.quiet.from}" data-set="settings.alarm.quiet.from" aria-label="Mulai"><span>–</span><input type="time" value="${A.quiet.to}" data-set="settings.alarm.quiet.to" aria-label="Selesai"></div>` : ''}
      </div>
      <button class="btn btn-soft btn-lg" data-act="testAlarm">${ic('play', 18)} Tes bunyi alarm</button>

      <div class="sec-h"><h3>${ic('music', 16)} Penenang otomatis</h3></div>
      <div class="card">
        ${row('Putar saat bayi menangis/gelisah', store.s.mode === 'parent' ? 'Diputar di speaker HP kamera bayi' : '', toggle('settings.alarm.autoSoothe', A.autoSoothe, { after: 'rerender', label: 'Penenang otomatis' }))}
        ${A.autoSoothe ? `<div class="set-sub"><select data-set="settings.alarm.sootheTrack" aria-label="Pilih penenang">${Object.entries(TRACKS).map(([k, t]) => `<option value="${k}" ${A.sootheTrack === k ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
          ${seg('settings.alarm.sootheMins', [[10, '10m'], [20, '20m'], [45, '45m']], A.sootheMins, { num: true })}</div>` : ''}
      </div>

      <div class="sec-h"><h3>${ic('bottle', 16)} Pengingat menyusu</h3></div>
      <div class="card">
        ${row('Ingatkan setelah susu terakhir', 'Toast, getar & suara lembut — bukan alarm darurat', '')}
        ${seg('settings.feedEvery', [[0, 'Mati'], [120, '2 j'], [150, '2,5 j'], [180, '3 j'], [240, '4 j']], S.feedEvery, { num: true })}
      </div>

      <div class="sec-h"><h3>${ic('sun', 16)} Tampilan</h3></div>
      ${opts('settings.theme', [['auto', 'sparkles', 'Otomatis'], ['light', 'sun', 'Terang'], ['dark', 'moon', 'Gelap']], S.theme)}
      <p class="fine">Otomatis = gelap pukul 18.00–06.00, nyaman dilihat di kamar tidur.</p>
      ${store.s.mode === 'baby' ? `<div class="card">${row('Redupkan layar kamera', 'Otomatis 45 detik setelah orang tua tersambung', toggle('settings.babyDim', S.babyDim))}</div>` : ''}
      ${disclaimer()}
    </div>`;
  },
});
actions.detToggle = el => { const d = store.s.settings.detect[el.dataset.t]; d.on = !d.on; store.save(); router.refresh(); };
actions.detSens = el => { const d = store.s.settings.detect[el.dataset.t]; d.on = true; d.sens = SENS[+el.dataset.v - 1]; store.save(); router.refresh(); };
actions.setOpt = el => {
  const v = el.dataset.v;
  store.set(el.dataset.path, isNaN(+v) ? v : +v);
  if (el.dataset.path === 'settings.theme') applyTheme();
  router.refresh();
};
actions.rerender = () => router.refresh();
actions.askNotify = el => {
  if (el.checked && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => toast(p === 'granted' ? 'Notifikasi diizinkan' : 'Notifikasi ditolak browser', { icon: 'bell' }));
  }
};
let testing = false;
actions.testAlarm = async el => {
  if (testing) return;
  testing = true; el.disabled = true;
  const A = store.s.settings.alarm;
  await testAlarm({ style: A.sound, volume: A.volume, babyName: store.s.baby.name });
  testing = false; el.disabled = false;
};

/* ================= Kunci aplikasi (PIN) ================= */
let unlocked = false;
export const needsUnlock = () => !!store.s.settings.pinHash && !unlocked;

function pinPad(title, sub) {
  return `<div class="pin">
    <div class="pin-top">${ic('lock', 30)}<h2>${title}</h2><p class="muted">${sub}</p></div>
    <div class="pin-dots" id="pin-dots">${'<i></i>'.repeat(4)}</div>
    <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="pin-k" data-k="${n}">${n}</button>`).join('')}
      <span></span><button class="pin-k" data-k="0">0</button><button class="pin-k ghost" data-k="del" aria-label="Hapus">${ic('chevL', 22)}</button></div>
  </div>`;
}
/** Hubungkan tombol angka. onFull(pin) → true (selesai) · 'next' (kosongkan, lanjut) · false (salah). */
function bindPad(root, onFull) {
  let buf = '';
  const dots = () => $$('#pin-dots i', root).forEach((d, i) => d.classList.toggle('on', i < buf.length));
  $$('.pin-k', root).forEach(b => {
    b.onclick = async () => {
      const k = b.dataset.k;
      if (k === 'del') buf = buf.slice(0, -1);
      else if (buf.length < 4) buf += k;
      dots();
      if (buf.length < 4) return;
      const res = await onFull(buf);
      if (res === 'next') { buf = ''; setTimeout(dots, 150); }
      else if (!res) {
        $('#pin-dots', root)?.classList.add('err');
        setTimeout(() => { $('#pin-dots', root)?.classList.remove('err'); buf = ''; dots(); }, 450);
      }
    };
  });
}
route('lock', {
  render: () => pinPad('Aplikasi terkunci', 'Masukkan PIN 4 angka'),
  mount(root) {
    bindPad(root, async pin => {
      if (await sha256('aibm:' + pin) !== store.s.settings.pinHash) return false;
      unlocked = true;
      router.go('home', { replace: true });
      return true;
    });
  },
});
actions.pinSheet = () => {
  const on = !!store.s.settings.pinHash;
  let first = '';
  sheet(`${pinPad(on ? 'Ubah atau matikan PIN' : 'Buat PIN', on ? 'Masukkan PIN baru, atau matikan kunci' : 'Diminta setiap aplikasi dibuka')}
    ${on ? `<button class="btn btn-soft" data-act="pinOff">${ic('x', 16)} Matikan kunci aplikasi</button>` : ''}`, {
    onMount: root => bindPad(root, async pin => {
      const msg = $('.pin-top p', root);
      if (!first) { first = pin; msg.textContent = 'Ulangi PIN untuk konfirmasi'; return 'next'; }
      if (pin !== first) { first = ''; msg.textContent = 'PIN tidak sama — buat ulang'; return false; }
      store.set('settings.pinHash', await sha256('aibm:' + pin));
      unlocked = true; closeSheet(); toast('Kunci aplikasi aktif', { icon: 'lock', tone: 'ok' });
      if (router.current.name === 'more') router.refresh();
      return true;
    }),
  });
};
actions.pinOff = () => {
  store.set('settings.pinHash', '');
  closeSheet(); toast('Kunci aplikasi dimatikan', { icon: 'lock' });
  if (router.current.name === 'more') router.refresh();
};

/* ================= Bantuan & tentang ================= */
route('help', {
  render({ about }) {
    if (about) {
      return topbar('Tentang') + `<div class="stack center-col">
        <div class="about-logo">${logo(72)}</div><h2>AI Baby Monitor</h2><p class="muted">Tidur nyenyak, bayi lebih aman</p><span class="chip">Versi 3.0</span>
        <div class="card"><p>Aplikasi pemantau bayi yang mengubah dua HP menjadi kamera bayi & monitor orang tua, dengan deteksi tangisan dan gerakan langsung di perangkat, alarm suara Bahasa Indonesia, penenang otomatis, serta jurnal tidur & perawatan.</p></div>
        ${disclaimer()}</div>`;
    }
    const faq = [
      ['Apa saja yang dibutuhkan?', 'Dua perangkat dengan browser modern (Chrome/Safari): satu jadi <b>kamera bayi</b> (HP lama pun bisa), satu jadi <b>monitor orang tua</b>. Keduanya butuh internet saat pertama tersambung; untuk hasil terbaik gunakan Wi-Fi yang sama.'],
      ['Bagaimana menyambungkan?', 'Di HP kamera pilih <b>Jadikan HP ini kamera bayi</b> → Mulai kamera. Di HP orang tua pindai QR yang muncul (pakai aplikasi kamera bawaan) atau masukkan kode & kunci 6 angka.'],
      ['Apa yang bisa dideteksi?', 'Tangisan (suara keras di frekuensi tangisan bayi yang bertahan beberapa detik), gelisah/terbangun (gerakan pada gambar), dan sambungan kamera terputus. Deteksi tengkurap/muntah/napas butuh model AI khusus dan baru tersedia di mode demo.'],
      ['Apakah alarm berbunyi saat HP terkunci?', 'Browser HP membatasi suara saat aplikasi ditutup atau layar terkunci. Gunakan <b>Mode tidur</b>: layar dibuat hampir hitam namun tetap menyala, sehingga alarm pasti terdengar. Colokkan pengisi daya.'],
      ['Apakah video saya aman?', 'Video & suara mengalir langsung antar-HP (WebRTC, terenkripsi). Server hanya dipakai untuk memperkenalkan kedua HP. Orang tanpa kunci 6 angka akan ditolak. Tidak ada video yang disimpan di server.'],
      ['Kenapa tidak tersambung?', 'Pastikan aplikasi di HP kamera tetap terbuka dan statusnya “Siap”. Jaringan seluler tertentu memblokir koneksi langsung — coba sambungkan kedua HP ke Wi-Fi yang sama.'],
      ['Apakah AI bisa salah?', 'Bisa. Kipas angin, TV, atau cahaya yang berubah dapat memicu alarm palsu; selimut tebal bisa meredam gerakan. Tandai “Alarm palsu” dan atur sensitivitas di Alarm & deteksi. Aplikasi ini bukan alat medis.'],
    ];
    return topbar('Bantuan') + `<div class="stack">
      <div class="card list">${faq.map(([q, a]) => `<details class="faq"><summary>${q}${ic('chevD', 18)}</summary><p>${a}</p></details>`).join('')}</div>
      ${disclaimer()}
    </div>`;
  },
});

