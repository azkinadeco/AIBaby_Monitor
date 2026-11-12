/* DETEKTOR ASLI — berjalan di perangkat yang menjadi kamera bayi.
   • Suara: level suara + "skor tangisan" (suara keras di atas kebisingan latar,
     dengan energi dominan di rentang frekuensi tangisan bayi ±250–3000 Hz, bertahan beberapa detik).
   • Gerakan: selisih piksel antar-frame pada gambar kecil 64×48 (ringan untuk HP lama).
   Semua analisis lokal; tidak ada video yang dikirim ke server. */
import { audioContext } from './audio.js';
import { avg, clamp } from '../core/util.js';

const FRAME_MS = 100;          // analisis audio 10× per detik
const MOTION_MS = 200;         // analisis gerakan 5× per detik
const CRY_WINDOW = 40;         // 4 detik terakhir

export class Detector {
  constructor() {
    this.stream = null;
    this.video = null;
    this.facing = 'environment';
    this._timers = [];
    this._levels = [];
    this._cryFrames = [];
    this._floor = 30;
    this._calib = 0;
    this._motion = 0;
    this._prev = null;
    this._cv = Object.assign(document.createElement('canvas'), { width: 64, height: 48 });
    this._cx = this._cv.getContext('2d', { willReadFrequently: true });
  }

  get running() { return !!this.stream; }

  async start({ facing = this.facing, video = true } = {}) {
    this.stop();
    this.facing = facing;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: video ? { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } : false,
      // matikan pemrosesan suara bawaan supaya level tangisan terbaca apa adanya
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    if (video) {
      this.video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true });
      this.video.setAttribute('playsinline', '');
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
    }
    this._setupAudio();
    this._timers.push(setInterval(() => this._audioFrame(), FRAME_MS));
    if (video) this._timers.push(setInterval(() => this._motionFrame(), MOTION_MS));
    return this.stream;
  }

  stop() {
    this._timers.forEach(clearInterval); this._timers = [];
    this.stream?.getTracks().forEach(t => t.stop());
    try { this._src?.disconnect(); } catch { /* */ }
    this.stream = null; this.video = null; this._src = null; this._an = null;
    this._prev = null; this._levels = []; this._cryFrames = []; this._motion = 0; this._calib = 0;
  }

  async flip() {
    return this.start({ facing: this.facing === 'user' ? 'environment' : 'user' });
  }

  _setupAudio() {
    const ac = audioContext();
    if (!ac || !this.stream.getAudioTracks().length) return;
    this._src = ac.createMediaStreamSource(this.stream);
    this._an = ac.createAnalyser();
    this._an.fftSize = 2048;
    this._an.smoothingTimeConstant = 0;
    this._src.connect(this._an);           // TIDAK disambung ke speaker (hindari dengung)
    this._td = new Float32Array(this._an.fftSize);
    this._fd = new Float32Array(this._an.frequencyBinCount);
    const hz = ac.sampleRate / this._an.fftSize;
    this._bin = f => Math.round(f / hz);
  }

  _audioFrame() {
    const an = this._an; if (!an) return;
    an.getFloatTimeDomainData(this._td);
    let sum = 0;
    for (let i = 0; i < this._td.length; i++) sum += this._td[i] * this._td[i];
    const rms = Math.sqrt(sum / this._td.length) || 1e-8;
    const dbfs = 20 * Math.log10(rms);
    const level = clamp(((dbfs + 75) / 65) * 100, 0, 100);      // 0 = sunyi, 100 = sangat keras

    // kebisingan latar: dikalibrasi 1,5 detik pertama, lalu turun cepat & naik pelan (adaptif terhadap kipas/AC)
    if (this._calib < 15) { this._calib++; this._floor = this._calib === 1 ? level : Math.min(this._floor, level); }
    else this._floor = level < this._floor ? level : this._floor + .04;

    const cryFrame = level - this._floor > 18 && level > 40 && this._cryLike();

    this._levels.push(level); if (this._levels.length > 10) this._levels.shift();
    this._cryFrames.push(cryFrame ? 1 : 0); if (this._cryFrames.length > CRY_WINDOW) this._cryFrames.shift();
  }

  /** Apakah spektrum frame ini mirip tangisan bayi?
   *  1) energi dominan di 250–3000 Hz,
   *  2) bernada/harmonis: sebagian besar energi ada di puncak tajam (desis kipas/AC/hujan tidak),
   *  3) nada dasar ≥ 280 Hz (suara orang dewasa & TV umumnya 85–255 Hz). */
  _cryLike() {
    const an = this._an, fd = this._fd, P = this._P ||= new Float32Array(fd.length);
    an.getFloatFrequencyData(fd);
    const b0 = this._bin(80), b1 = Math.min(this._bin(8000), fd.length - 9);
    let total = 0;
    for (let i = 0; i <= b1 + 8; i++) { P[i] = Math.pow(10, fd[i] / 10); if (i >= b0 && i <= b1) total += P[i]; }
    const c0 = this._bin(250), c1 = this._bin(3000), lo = Math.max(9, this._bin(150));
    let band = 0, tonal = 0, pmax = 0;
    const peaks = [];
    for (let i = lo; i <= c1; i++) {
      let nb = 0;
      for (let j = 3; j <= 8; j++) nb += P[i - j] + P[i + j];
      nb /= 12;
      const p = P[i], sharp = p > 8 * nb;
      if (i >= c0) { band += p; if (sharp) tonal += p; }
      if (sharp && p >= P[i - 1] && p >= P[i + 1] && i <= this._bin(1000)) { peaks.push(i); pmax = Math.max(pmax, p); }
    }
    if (!total || band / total < .5 || tonal / band < .35) return false;
    const f0 = peaks.find(i => P[i] > pmax * .1);
    return f0 === undefined || f0 >= this._bin(280);
  }

  _motionFrame() {
    const v = this.video;
    if (!v || v.readyState < 2) return;
    const W = 64, H = 48;
    this._cx.drawImage(v, 0, 0, W, H);
    const px = this._cx.getImageData(0, 0, W, H).data;
    const gray = new Uint8Array(W * H);
    let mean = 0;
    for (let i = 0, j = 0; i < px.length; i += 4, j++) { gray[j] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8; mean += gray[j]; }
    mean /= gray.length;
    if (this._prev) {
      // ambang menyesuaikan kecerahan: gambar gelap (malam) lebih berisik
      const thr = mean < 50 ? 30 : 22;
      let changed = 0;
      for (let i = 0; i < gray.length; i++) if (Math.abs(gray[i] - this._prev[i]) > thr) changed++;
      const pct = clamp((changed / gray.length) * 100 * 5, 0, 100);
      this._motion = this._motion * .6 + pct * .4;
    }
    this._prev = gray;
    this._dark = mean < 35;
  }

  /** Bacaan ringkas (dipanggil Monitor tiap detik) */
  read() {
    if (!this.stream) return { online: false };
    return {
      online: true,
      level: avg(this._levels),
      cry: avg(this._cryFrames),
      motion: this._motion,
      dark: !!this._dark,
    };
  }
}
