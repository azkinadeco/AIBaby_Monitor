/* Kamera DUMMY: merender tampilan CCTV dari atas boks bayi menggunakan canvas.
   Saat hardware tersedia, modul ini diganti dengan player stream (WebRTC/HLS dari gateway RTSP). */
const Camera = (() => {
  const W = 640, H = 400;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const c = off.getContext('2d');

  const view = {
    baby: 'sleep',        // sleep | awake | cry | move | prone | vomit | distress
    rpm: 32,
    online: true,
    night: false,
    overlay: true,
    camName: 'CAM-01 · Kamar Bayi',
    ai: { label: 'BAYI 97%', status: 'TIDUR', alert: false },
    lullaby: false,
    mode: 'sim',          // 'sim' | 'webcam' | 'remote'
    facing: 'environment',
    zoom: 1,
    panX: 0,
    panY: 0,
    roi: null,
  };
  let lastFrame = 0, breathPhase = 0, lastT = 0;
  const targets = new Set();

  /* ---------------- Webcam / Kamera Asli & Deteksi Gerakan ---------------- */
  let videoEl = null, mediaStream = null, audioStream = null, analyser = null, audioData = null;
  const motionCv = document.createElement('canvas');
  motionCv.width = 80; motionCv.height = 50;
  const motionCtx = motionCv.getContext('2d', { willReadFrequently: true });
  let prevPixels = null, liveMotionVal = 0, liveDbVal = 32;
  let remoteImg = null;

  async function startWebcam(facing = view.facing) {
    stopWebcam();
    try {
      view.facing = facing;
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 400 } },
        audio: true,
      });
      videoEl = document.createElement('video');
      videoEl.srcObject = mediaStream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      await videoEl.play();

      // Setup mikrofon untuk deteksi dB (tangisan)
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && mediaStream.getAudioTracks().length) {
        const ac = new AC();
        const src = ac.createMediaStreamSource(mediaStream);
        analyser = ac.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        audioData = new Uint8Array(analyser.frequencyBinCount);
      }
      prevPixels = null;
      view.mode = 'webcam';
      return true;
    } catch (err) {
      console.warn('Gagal membuka kamera/mikrofon:', err);
      view.mode = 'sim';
      return false;
    }
  }

  function stopWebcam() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    if (videoEl) { videoEl.srcObject = null; videoEl = null; }
    analyser = null; audioData = null; prevPixels = null;
    if (view.mode === 'webcam') view.mode = 'sim';
  }

  async function flipWebcam() {
    const next = view.facing === 'user' ? 'environment' : 'user';
    return startWebcam(next);
  }

  function setRemoteFrame(dataUrl) {
    if (!remoteImg) remoteImg = new Image();
    remoteImg.src = dataUrl;
    view.mode = 'remote';
  }

  function sampleSensors() {
    if (view.mode !== 'webcam' || !videoEl || videoEl.readyState < 2) return null;
    // Hitung gerakan dari selisih piksel antar frame
    motionCtx.drawImage(videoEl, 0, 0, 80, 50);
    const cur = motionCtx.getImageData(0, 0, 80, 50).data;
    if (prevPixels) {
      let diff = 0;
      for (let i = 0; i < cur.length; i += 4) {
        const d = Math.abs(cur[i] - prevPixels[i]) + Math.abs(cur[i + 1] - prevPixels[i + 1]) + Math.abs(cur[i + 2] - prevPixels[i + 2]);
        if (d > 45) diff++;
      }
      const pct = Math.min(100, (diff / (80 * 50)) * 260);
      liveMotionVal = liveMotionVal * 0.65 + pct * 0.35;
    }
    prevPixels = new Uint8ClampedArray(cur);

    // Hitung dB suara dari mikrofon
    if (analyser && audioData) {
      analyser.getByteTimeDomainData(audioData);
      let sum = 0;
      for (let i = 0; i < audioData.length; i++) {
        const v = (audioData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / audioData.length);
      const db = Math.min(96, Math.max(28, 30 + rms * 195));
      liveDbVal = liveDbVal * 0.6 + db * 0.4;
    }
    return { db: liveDbVal, motion: liveMotionVal };
  }

  function rr(x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ell(x, y, rx, ry, fill, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
  function circ(x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }

  /* ---------------- Ruangan & boks ---------------- */
  function drawRoom() {
    // lantai kayu
    c.fillStyle = '#7d624d'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2;
    for (let y = 0; y < H; y += 46) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // rangka boks
    c.fillStyle = '#eadcc8'; rr(36, 26, 568, 348, 18); c.fill();
    c.fillStyle = '#d9c6ab'; rr(46, 36, 548, 328, 14); c.fill();
    // kasur
    const g = c.createLinearGradient(0, 56, 0, 344);
    g.addColorStop(0, '#f7f4ef'); g.addColorStop(1, '#ebe5dc');
    c.fillStyle = g; rr(60, 54, 520, 292, 12); c.fill();
    // motif sprei: bintang kecil
    c.fillStyle = 'rgba(126,150,214,.28)';
    for (let y = 74; y < 340; y += 34) for (let x = 78 + ((y / 34) % 2) * 17; x < 572; x += 34) star(x, y, 4);
    // jeruji atas & bawah
    c.fillStyle = '#cbb495';
    for (let x = 64; x < 580; x += 30) { rr(x, 28, 9, 24, 4); c.fill(); rr(x, 348, 9, 24, 4); c.fill(); }
    // boneka beruang di pojok
    teddy(530, 96);
  }
  function star(x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r;
      c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath(); c.fill();
  }
  function teddy(x, y) {
    const b = '#c99a6b', d = '#a77a4f';
    circ(x - 17, y - 22, 10, b); circ(x + 17, y - 22, 10, b);
    circ(x - 17, y - 22, 5, d); circ(x + 17, y - 22, 5, d);
    ell(x, y + 26, 24, 22, b);
    circ(x, y, 22, b);
    ell(x, y + 7, 9, 7, '#e3c39e');
    circ(x - 7, y - 4, 2.6, '#3a2a1e'); circ(x + 7, y - 4, 2.6, '#3a2a1e'); circ(x, y + 5, 2.6, '#3a2a1e');
  }

  /* ---------------- Bayi ---------------- */
  const SKIN = '#f2c7a2', SKIN_D = '#e2ad86', HAIR = '#5c3f2b', SUIT = '#9cbff0', SUIT_D = '#7fa6dd', BLANKET = '#f5c6d4';

  function arm(sx, sy, ex, ey, hx, hy) {
    c.strokeStyle = SUIT; c.lineWidth = 24; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(ex, ey, hx, hy); c.stroke();
    circ(hx, hy, 12, SKIN);
    circ(hx - 3, hy - 2, 3, SKIN_D);
  }

  function drawBaby(t, st) {
    const breath = Math.sin(breathPhase);
    let ox = 0, oy = 0, rot = 0;
    if (st === 'move') { ox = Math.sin(t * 3.1) * 20; oy = Math.cos(t * 2.3) * 15; rot = Math.sin(t * 1.7) * .2; }
    else if (st === 'cry') { ox = Math.sin(t * 11) * 2.2; rot = Math.sin(t * 6) * .045; }
    else if (st === 'awake') { rot = Math.sin(t * .9) * .06; }
    else if (st === 'prone') { rot = .22; ox = 10; oy = 8; }
    else if (st === 'vomit') { rot = Math.sin(t * 4) * .03; }

    const cx = 300 + ox, cy = 200 + oy;
    c.save(); c.translate(cx, cy); c.rotate(rot);

    // bayangan
    ell(30, 10, 200, 92, 'rgba(60,40,20,.10)');

    const prone = st === 'prone';
    const k = 1 + breath * (st === 'distress' ? .055 : .03);

    // lengan (gaya tidur "tangan ke atas" saat tidur)
    let la, ra;
    if (st === 'sleep' || st === 'distress') { la = [-150, -64]; ra = [-150, 64]; }
    else if (prone) { la = [-150, -58]; ra = [-150, 58]; }
    else if (st === 'cry') { la = [-120 + Math.sin(t * 9) * 26, -86 + Math.cos(t * 7) * 12]; ra = [-115 + Math.cos(t * 8) * 26, 86 + Math.sin(t * 10) * 12]; }
    else if (st === 'move') { la = [-100 + Math.sin(t * 6) * 30, -92]; ra = [-90 + Math.cos(t * 5) * 30, 92]; }
    else if (st === 'vomit') { la = [-80, -78]; ra = [-80, 78]; }
    else { la = [-110 + Math.sin(t * 2.4) * 14, -86]; ra = [-40 + Math.cos(t * 2) * 10, 84]; }

    // badan (baju bayi)
    ell(10, 0, 108, 62 * k, SUIT);
    if (prone) { c.strokeStyle = SUIT_D; c.lineWidth = 3; c.beginPath(); c.moveTo(-70, 0); c.lineTo(110, 0); c.stroke(); }
    else { ell(-55, 0, 18, 30, '#c4dbf8'); circ(-20, -8, 3.5, '#fff'); circ(-20, 8, 3.5, '#fff'); }

    arm(-60, -46, (-60 + la[0]) / 2, la[1] - 6, la[0], la[1]);
    arm(-60, 46, (-60 + ra[0]) / 2, ra[1] + 6, ra[0], ra[1]);

    // selimut (naik turun mengikuti napas)
    const bTop = -78 * k, bBot = 78 * k, kick = (st === 'move' || prone) ? 60 : 0;
    c.save();
    c.beginPath();
    c.moveTo(30 + kick, bTop);
    for (let y = bTop; y <= bBot; y += 12) c.lineTo(30 + kick + Math.sin(y * .15) * 4, y);
    c.lineTo(200, bBot + 4); c.quadraticCurveTo(214, 0, 200, bTop - 4); c.closePath();
    c.fillStyle = BLANKET; c.fill();
    c.clip();
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (let x = 40; x < 210; x += 20) for (let y = -90; y < 90; y += 20) circ(x + kick, y + ((x / 20) % 2) * 10, 3, 'rgba(255,255,255,.55)');
    c.restore();
    c.strokeStyle = '#e9a8bc'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(32 + kick, bTop); c.lineTo(32 + kick, bBot); c.stroke();

    // kepala
    const hx = -125, hy = 0, hr = 50;
    if (prone) {
      circ(hx, hy, hr, SKIN);
      circ(hx + 4, hy - 47, 10, SKIN); circ(hx + 4, hy + 47, 10, SKIN);
      c.beginPath(); c.arc(hx, hy, hr, Math.PI * .32, Math.PI * 1.68); c.closePath(); c.fillStyle = HAIR; c.fill();
      circ(hx - 6, hy, hr * .78, HAIR);
      c.strokeStyle = '#46301f'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(hx - 14, hy, 12, 0, Math.PI * 1.6); c.stroke();
      c.beginPath(); c.arc(hx - 14, hy, 22, .3, Math.PI * 1.3); c.stroke();
    } else {
      circ(hx + 2, hy - 49, 10, SKIN); circ(hx + 2, hy + 49, 10, SKIN);
      const g = c.createRadialGradient(hx + 10, hy - 10, 10, hx, hy, hr);
      g.addColorStop(0, '#f8d6b8'); g.addColorStop(1, SKIN);
      circ(hx, hy, hr, g);
      if (st === 'distress') circ(hx, hy, hr, 'rgba(110,140,220,.28)');
      // rambut
      c.beginPath(); c.arc(hx, hy, hr, Math.PI * .62, Math.PI * 1.38); c.closePath(); c.fillStyle = HAIR; c.fill();
      c.beginPath(); c.moveTo(hx - 44, hy - 6); c.quadraticCurveTo(hx - 24, hy - 2, hx - 30, hy + 12); c.fillStyle = HAIR; c.fill();
      face(t, st, hx, hy);
    }

    // muntah
    if (st === 'vomit') {
      c.fillStyle = 'rgba(238,228,170,.95)';
      c.beginPath();
      c.moveTo(hx + 32, hy + 4);
      c.bezierCurveTo(hx + 60, hy + 40, hx + 30, hy + 80, hx - 6, hy + 92);
      c.bezierCurveTo(hx - 30, hy + 98, hx - 10, hy + 62, hx + 10, hy + 46);
      c.closePath(); c.fill();
      circ(hx + 40, hy + 70, 9, 'rgba(238,228,170,.9)');
      circ(hx + 18, hy + 102, 6, 'rgba(238,228,170,.85)');
    }

    c.restore();
    return { cx, cy, rot, hx, hy };
  }

  function face(t, st, hx, hy) {
    const ex = hx - 2, eyY = 18;
    c.lineCap = 'round';
    // pipi
    circ(hx + 18, hy - 28, 9, 'rgba(240,120,130,.28)');
    circ(hx + 18, hy + 28, 9, 'rgba(240,120,130,.28)');
    // mata
    if (st === 'cry') {
      c.strokeStyle = '#4a2f22'; c.lineWidth = 3.5;
      [-1, 1].forEach(s => { c.beginPath(); c.moveTo(ex - 6, hy + s * eyY - 6); c.lineTo(ex + 2, hy + s * eyY); c.lineTo(ex - 6, hy + s * eyY + 6); c.stroke(); });
      circ(hx + 14, hy - 36 + Math.sin(t * 4) * 2, 4, 'rgba(120,190,255,.9)');
      circ(hx + 20, hy + 37 + Math.cos(t * 4) * 2, 4, 'rgba(120,190,255,.9)');
    } else if (st === 'awake' || st === 'move' || st === 'vomit') {
      const blink = (t % 3.2) < .12;
      [-1, 1].forEach(s => {
        if (blink) { c.strokeStyle = '#4a2f22'; c.lineWidth = 3; c.beginPath(); c.moveTo(ex - 5, hy + s * eyY); c.lineTo(ex + 5, hy + s * eyY); c.stroke(); }
        else { ell(ex, hy + s * eyY, 6.5, 5.5, '#3a271c'); circ(ex - 2, hy + s * eyY - 2, 1.8, '#fff'); }
      });
    } else {
      c.strokeStyle = '#4a2f22'; c.lineWidth = 3;
      [-1, 1].forEach(s => { c.beginPath(); c.arc(ex - 4, hy + s * eyY, 7, -Math.PI / 2.4, Math.PI / 2.4); c.stroke(); });
    }
    // hidung
    ell(hx + 16, hy, 3.5, 4.5, SKIN_D);
    // mulut
    const mx = hx + 30;
    if (st === 'cry') {
      const open = 10 + Math.abs(Math.sin(t * 6)) * 4;
      ell(mx, hy, open * .8, 12, '#8e2f36'); ell(mx + 3, hy, 4, 6, '#e0707a');
    } else if (st === 'vomit') {
      ell(mx, hy, 6, 9, '#8e2f36');
    } else if (st === 'distress') {
      ell(mx, hy, 4, 7, '#6d74b8');
    } else if (st === 'awake') {
      c.strokeStyle = '#a3524f'; c.lineWidth = 3; c.beginPath(); c.arc(mx - 6, hy, 9, -Math.PI / 3, Math.PI / 3); c.stroke();
    } else {
      c.strokeStyle = '#b5615c'; c.lineWidth = 3; c.beginPath(); c.arc(mx - 4, hy, 5, -Math.PI / 3, Math.PI / 3); c.stroke();
    }
  }

  /* ---------------- Overlay CCTV & AI ---------------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function drawHud(pos) {
    const d = new Date();
    const ts = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    c.font = '600 15px "JetBrains Mono", ui-monospace, monospace';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(0,0,0,.45)'; rr(10, 10, c.measureText(ts).width + 16, 26, 6); c.fill();
    c.fillStyle = '#fff'; c.fillText(ts, 18, 23.5);
    const nm = view.camName;
    const w = c.measureText(nm).width + 16;
    c.fillStyle = 'rgba(0,0,0,.45)'; rr(W - w - 10, 10, w, 26, 6); c.fill();
    c.fillStyle = '#fff'; c.fillText(nm, W - w - 2, 23.5);
    if (view.night) {
      c.fillStyle = 'rgba(0,0,0,.45)'; rr(10, H - 36, 74, 26, 6); c.fill();
      c.fillStyle = '#fff'; c.fillText('IR ON', 18, H - 23);
    }
    if (view.lullaby) {
      c.fillStyle = 'rgba(0,0,0,.45)'; rr(view.night ? 92 : 10, H - 36, 104, 26, 6); c.fill();
      c.fillStyle = '#fff'; c.fillText('♪ LULLABY', (view.night ? 100 : 18), H - 23);
    }
    if (view.zoom > 1) {
      const zt = `${view.zoom}x ZOOM`;
      const zw = c.measureText(zt).width + 16;
      c.fillStyle = 'rgba(91,108,249,.85)'; rr(W - zw - 10, H - 36, zw, 26, 6); c.fill();
      c.fillStyle = '#fff'; c.fillText(zt, W - zw - 2, H - 23);
    }
    if (view.roi && view.roi.on) {
      const rx = view.roi.x * W, ry = view.roi.y * H, rw = view.roi.w * W, rh = view.roi.h * H;
      c.save();
      c.setLineDash([6, 6]); c.strokeStyle = 'rgba(116,132,255,.7)'; c.lineWidth = 2;
      c.strokeRect(rx, ry, rw, rh);
      c.font = '700 11px "JetBrains Mono", ui-monospace, monospace';
      c.fillStyle = 'rgba(116,132,255,.85)'; rr(rx + 6, ry + 6, 84, 18, 4); c.fill();
      c.fillStyle = '#fff'; c.fillText('ZONA AMAN', rx + 12, ry + 15.5);
      c.restore();
    }

    if (!view.overlay || !pos) return;
    const col = view.ai.alert ? '#ff4d5e' : '#3ff0a6';
    const bx = pos.cx - 200, by = pos.cy - 112, bw = 420, bh = 224;
    c.strokeStyle = col; c.lineWidth = 3;
    const L = 22;
    [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach(([x, y, sx, sy]) => {
      c.beginPath(); c.moveTo(x + sx * L, y); c.lineTo(x, y); c.lineTo(x, y + sy * L); c.stroke();
    });
    // kotak kepala/wajah
    const hx = pos.cx + Math.cos(pos.rot) * pos.hx - Math.sin(pos.rot) * pos.hy;
    const hy = pos.cy + Math.sin(pos.rot) * pos.hx + Math.cos(pos.rot) * pos.hy;
    c.setLineDash([5, 4]); c.lineWidth = 2;
    c.strokeRect(hx - 58, hy - 58, 116, 116); c.setLineDash([]);
    // label
    c.font = '700 13px "JetBrains Mono", ui-monospace, monospace';
    const label = `${view.ai.label} · ${view.ai.status}`;
    const lw = c.measureText(label).width + 14;
    c.fillStyle = col; rr(bx, by - 26, lw, 22, 5); c.fill();
    c.fillStyle = view.ai.alert ? '#fff' : '#05271a'; c.fillText(label, bx + 7, by - 15);
  }

  function noise(n = 260) {
    for (let i = 0; i < n; i++) {
      c.fillStyle = Math.random() > .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)';
      c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
  }

  function drawOffline() {
    c.fillStyle = '#16171f'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const v = Math.random() * 90 | 0;
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect(Math.random() * W, Math.random() * H, 3, 3);
    }
    c.fillStyle = 'rgba(0,0,0,.6)'; rr(W / 2 - 170, H / 2 - 44, 340, 88, 14); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 22px "Plus Jakarta Sans", sans-serif'; c.fillText('KAMERA OFFLINE', W / 2, H / 2 - 12);
    c.font = '500 14px "Plus Jakarta Sans", sans-serif'; c.fillStyle = '#c9cbe0';
    c.fillText('Mencoba menyambung ulang…', W / 2, H / 2 + 16);
    c.textAlign = 'left';
  }

  function draw(t) {
    const dt = Math.min(.1, t - lastT); lastT = t;
    breathPhase += dt * 2 * Math.PI * (view.rpm / 60);
    if (!view.online) { drawOffline(); return; }
    let pos = { cx: 310, cy: 200, rot: 0, hx: 0, hy: -25 };
    c.save();
    if (view.zoom > 1) {
      const z = view.zoom;
      const px = Math.max(-1, Math.min(1, view.panX || 0)) * (W * (z - 1) / (2 * z));
      const py = Math.max(-1, Math.min(1, view.panY || 0)) * (H * (z - 1) / (2 * z));
      c.translate(W / 2, H / 2);
      c.scale(z, z);
      c.translate(-W / 2 - px, -H / 2 - py);
    }
    if (view.mode === 'webcam' && videoEl && videoEl.readyState >= 2) {
      const vw = videoEl.videoWidth || W, vh = videoEl.videoHeight || H;
      const scale = Math.max(W / vw, H / vh);
      const dw = vw * scale, dh = vh * scale;
      c.save();
      if (view.facing === 'user') { c.translate(W, 0); c.scale(-1, 1); }
      c.drawImage(videoEl, (W - dw) / 2, (H - dh) / 2, dw, dh);
      c.restore();
    } else if (view.mode === 'remote' && remoteImg && remoteImg.complete && remoteImg.naturalWidth) {
      c.drawImage(remoteImg, 0, 0, W, H);
    } else {
      drawRoom();
      pos = drawBaby(t, view.baby);
    }
    c.restore();
    if (view.night) {
      // efek inframerah: hitam-putih + sedikit terang
      c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = '#b8c4bf'; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(40,46,44,1)'; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
      const vg = c.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 420);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
      noise(700);
    } else if (view.mode === 'sim') noise();
    drawHud(pos);
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - lastFrame < 40) return;   // ~25 fps
    lastFrame = ts;
    if (!targets.size) { lastT = ts / 1000; return; }
    draw(ts / 1000);
    targets.forEach(cv => {
      if (!cv.isConnected) { targets.delete(cv); return; }
      if (cv.width !== W) { cv.width = W; cv.height = H; }
      cv.getContext('2d').drawImage(off, 0, 0);
    });
  }
  requestAnimationFrame(loop);

  function scan(root = document) { root.querySelectorAll('canvas.cam').forEach(cv => targets.add(cv)); }

  function snapshot(w = 240, q = .7) {
    draw(performance.now() / 1000);
    const s = document.createElement('canvas');
    s.width = w; s.height = Math.round(w * H / W);
    s.getContext('2d').drawImage(off, 0, 0, s.width, s.height);
    return s.toDataURL('image/jpeg', q);
  }
  const fullSnapshot = () => { draw(performance.now() / 1000); return off.toDataURL('image/jpeg', .92); };

  return { view, scan, snapshot, fullSnapshot, startWebcam, stopWebcam, flipWebcam, setRemoteFrame, sampleSensors, get canvas() { return off; }, W, H };
})();
