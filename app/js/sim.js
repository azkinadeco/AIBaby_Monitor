/* PANEL SIMULASI — pengganti hardware selama kamera & speaker belum tersedia.
   Desktop: tampil di samping HP. Mobile: dibuka lewat tombol tabung (FAB). */
const SimPanel = (() => {
  const logs = [];
  const BABY = [
    ['sleep', 'Tidur normal', 'moon', 'ok'],
    ['awake', 'Bangun', 'sun', 'info'],
    ['cry', 'Menangis', 'volume', 'warn'],
    ['move', 'Gerakan berlebih', 'move', 'warn'],
    ['prone', 'Tengkurap', 'rotate', 'bad'],
    ['vomit', 'Muntah / tersedak', 'droplet', 'bad'],
    ['distress', 'Napas tidak normal', 'wind', 'bad'],
  ];

  function render() {
    const el = $('#sim-panel');
    const sim = Engine.sim;
    const spk = Store.s.speakers[0];
    el.innerHTML = `
      <div class="sp-head">
        <div><b>${ic('sparkles', 16)} Panel Simulasi</b><small>Pengganti kamera & sensor selama hardware belum tersedia</small></div>
        <button class="icon-btn sp-close" data-act="simClose" aria-label="Tutup">${ic('x', 20)}</button>
      </div>
      <div class="sp-sec">
        <h4>Kondisi bayi</h4>
        <div class="sp-grid">${BABY.map(([k, l, i, t]) => `<button class="sp-btn t-${t} ${sim.state === k ? 'on' : ''}" data-act="simBaby" data-k="${k}">${ic(i, 18)}<span>${l}</span></button>`).join('')}</div>
      </div>
      <div class="sp-sec">
        <h4>Sistem & jaringan</h4>
        <div class="sp-row"><span>${ic('camera', 16)} Kamera & Mic Asli</span><label class="switch"><input type="checkbox" ${Camera.view.mode === 'webcam' ? 'checked' : ''} data-act="simWebcam"><i></i></label></div>
        <div class="sp-row"><span>${ic('cctv', 16)} Kamera online</span><label class="switch"><input type="checkbox" ${sim.camOnline ? 'checked' : ''} data-act="simCam"><i></i></label></div>
        <div class="sp-row"><span>${ic('wifi', 16)} Internet rumah</span><label class="switch"><input type="checkbox" ${sim.internet ? 'checked' : ''} data-act="simNet"><i></i></label></div>
        <div class="sp-row"><span>${ic('thermo', 16)} Kamar panas (>29°C)</span><label class="switch"><input type="checkbox" ${sim.hotRoom ? 'checked' : ''} data-act="simHot"><i></i></label></div>
        <div class="sp-row"><span>${ic('moon', 16)} Mode malam</span><label class="switch"><input type="checkbox" ${sim.forceNight ? 'checked' : ''} data-act="simNight"><i></i></label></div>
        <div class="sp-row"><span>${ic('play', 16)} Demo otomatis</span><label class="switch"><input type="checkbox" ${Engine.autoDemo ? 'checked' : ''} data-act="simAuto"><i></i></label></div>
      </div>
      <div class="sp-sec">
        <h4>Speaker alarm</h4>
        <div class="spk-box">
          <div class="spk-dev" data-state="${spk ? 'idle' : 'off'}"><i class="led"></i><i class="grill"></i></div>
          <div><b>${esc(spk?.name || 'Belum ada speaker')}</b><small data-spk-label>${spk ? 'Standby — siap membunyikan alarm' : 'Tambahkan speaker saat setup'}</small></div>
        </div>
        <button class="btn btn-soft btn-sm full" data-act="stopAlarmSim">${ic('volumeX', 16)} Tombol bisu di speaker</button>
      </div>
      <div class="sp-sec">
        <h4>Log sistem</h4>
        <div class="sp-log" id="sp-log">${logs.map(l => `<div><time>${l.t}</time>${esc(l.m)}</div>`).join('') || '<div class="muted">Belum ada aktivitas</div>'}</div>
      </div>
      <button class="btn btn-soft btn-sm full" data-act="resetDemo">${ic('rotate', 16)} Reset data demo</button>
      <p class="sp-foot">Aktifkan suara perangkat agar alarm terdengar.</p>`;
  }

  function log(m) {
    logs.unshift({ t: fmtTimeS(Date.now()), m });
    if (logs.length > 40) logs.pop();
    const box = $('#sp-log');
    if (box) box.innerHTML = logs.map(l => `<div><time>${l.t}</time>${esc(l.m)}</div>`).join('');
  }

  return { render, log };
})();

Actions.simBaby = el => {
  Engine.setBaby(el.dataset.k);
  SimPanel.log(`Simulasi: kondisi bayi → ${el.querySelector('span').textContent}`);
  $$('.sp-btn').forEach(b => b.classList.toggle('on', b === el));
  if (window.innerWidth < 1000) closeSim();
};
Actions.simWebcam = async el => {
  if (el.checked) {
    const ok = await Camera.startWebcam();
    if (!ok) { el.checked = false; toast('Kamera asli tidak dapat diakses', { icon: 'alert', tone: 'warn' }); }
    else { toast('Kamera & mikrofon perangkat asli aktif', { icon: 'camera', tone: 'ok' }); SimPanel.log('Kamera & mikrofon asli diaktifkan'); }
  } else {
    Camera.stopWebcam();
    toast('Kembali ke kamera simulasi', { icon: 'sparkles' });
    SimPanel.log('Kamera simulasi aktif');
  }
  App.refresh();
};
Actions.simCam = el => { Engine.setCamera(el.checked); SimPanel.log(el.checked ? 'Simulasi: kamera dinyalakan' : 'Simulasi: kamera mati / Wi-Fi kamera putus'); if (['home', 'devices'].includes(App.route.name)) App.refresh(); };
Actions.simNet = el => { Engine.setInternet(el.checked); SimPanel.log(el.checked ? 'Internet tersambung' : 'Internet putus — beralih ke gateway lokal'); if (App.route.name === 'home') App.refresh(); };
Actions.simHot = el => { Engine.sim.hotRoom = el.checked; SimPanel.log(el.checked ? 'Simulasi: suhu kamar naik (>29°C)' : 'Simulasi: suhu kamar normal (25°C)'); setTimeout(() => App.refresh(), 600); };
Actions.simNight = el => { Engine.sim.forceNight = el.checked ? true : null; SimPanel.log(el.checked ? 'Mode malam dipaksa aktif' : 'Mode malam mengikuti pengaturan'); };
Actions.simAuto = el => { Engine.setAutoDemo(el.checked); SimPanel.log(el.checked ? 'Demo otomatis dimulai' : 'Demo otomatis dihentikan'); };
Actions.stopAlarmSim = () => { if (Sound.isAlarming()) { Alarm.mute(); SimPanel.log('Tombol fisik speaker ditekan — bunyi dimatikan'); } else toast('Speaker sedang tidak berbunyi', { icon: 'volumeX' }); };
Actions.simClose = () => closeSim();

function openSim() { SimPanel.render(); document.body.classList.add('sim-open'); }
function closeSim() { document.body.classList.remove('sim-open'); }
$('#sim-fab').addEventListener('click', openSim);
$('#sim-backdrop').addEventListener('click', closeSim);

Engine.on('log', m => SimPanel.log(m));
Engine.on('sim', () => {
  $$('.sp-btn').forEach(b => b.classList.toggle('on', b.dataset.k === Engine.sim.state));
});

/* ================= BOOT ================= */
(function boot() {
  // mode demo: perangkat dummy supaya beranda langsung hidup tanpa login/setup
  if (!Store.s.cameras.length) Store.s.cameras.push({ id: 'demo-cam', name: 'Kamar Bayi', room: 'Kamar Bayi', type: 'cloud', brand: 'Kamera Demo', status: 'online', res: 'HD', demo: true });
  if (!Store.s.speakers.length) Store.s.speakers.push({ id: 'demo-spk', name: 'Speaker HP ini', type: 'phone', volume: 90, status: 'online', demo: true });
  if (Store.s.cameras[0]) Camera.view.camName = `CAM-01 · ${Store.s.cameras[0].name}`;
  SimPanel.render();
  SimPanel.log('Sistem siap (mode simulasi)');
  App.go('splash', {}, { reset: true });
  // re-render panel saat setup selesai/berubah
  const _go = App.go.bind(App);
  App.go = (...a) => { _go(...a); if (['home', 'devices', 'splash'].includes(App.route.name)) SimPanel.render(); };
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* opsional */ });
  }
})();
