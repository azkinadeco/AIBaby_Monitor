# AI Baby Monitor — Prototipe Aplikasi (Web, Portrait)

**Live demo:** https://aibabymonitor.vercel.app

**Pakai di iPhone seperti aplikasi:** buka link di Safari → ketuk tombol Share → *Add to Home Screen*. Aplikasi terbuka layar penuh dengan ikon sendiri.

Aplikasi pemantau bayi berbasis AI sesuai PRD. Kamera CCTV, sensor, dan speaker **masih disimulasikan** (dummy) karena hardware belum tersedia.

## Cara menjalankan
```bash
cd app
python3 -m http.server 8765
```
Buka http://localhost:8765 — di laptop tampil bingkai HP + **Panel Simulasi** di samping.
Di HP (satu Wi-Fi): buka http://IP-LAPTOP:8765 — panel simulasi dibuka lewat tombol tabung (kanan bawah).

> Klik sekali di halaman agar browser mengizinkan suara (alarm sirene + suara Bahasa Indonesia).

## Fitur
- **Langsung ke Beranda (mode demo)** — login hanya diminta untuk fitur lanjutan (aktivitas, pengaturan, perangkat, keluarga, paket)
- **3 tab simpel:** Beranda · Live · Aktivitas (profil lewat avatar)
- Beranda visual: kamera live + status AI, gauge suara/gerakan/napas/posisi, tombol bulat (Lagu, Bicara, Tes, AI on/off), skor & timeline tidur 24 jam
- Live: bicara, lagu, dengar audio kamar, foto, mode malam (IR), deteksi AI pakai titik warna
- Alarm layar penuh + speaker (sirene + suara Bahasa Indonesia), konfirmasi, bisukan, alarm palsu, eskalasi ke keluarga
- Lagu tidur: Twinkle, Brahms, White noise + timer 15/30/60 menit + mini player dengan tombol stop
- Aktivitas: daftar kejadian + grafik tidur 7 hari
- Pengaturan berbentuk tile: on/off deteksi, sensitivitas, jenis bunyi, volume, jam tenang
- Setup kamera (QR paket / RTSP-ONVIF) & speaker; pilihan Paket Lengkap atau Paket Aplikasi
- **Mode gelap otomatis** (18.00–06.00) atau manual di Pengaturan → Tampilan
- Perangkat & Keluarga berbentuk kartu: volume speaker, tes, hapus, undang anggota, atur notifikasi per anggota
- Mode internet putus → gateway lokal tetap membunyikan alarm
- **Kamera & Mikrofon Asli (WebRTC / Web Audio API)** — beralih dari kamera simulasi ke kamera & mikrofon HP/laptop asli untuk mendeteksi suara tangisan (dB) dan gerakan piksel secara *real-time*
- **Digital Zoom (1x–3x), Pan, Zona Aman Boks (AI Geofence), & Picture-in-Picture (PiP)** — kontrol kamera canggih dan jendela video mengambang
- **Smart Auto-Soothe AI & 6 Suara Penenang** — Twinkle, Brahms, Nina Bobo, White Noise, Hujan Lembut, dan Detak Jantung Ibu (otomatis menyala saat bayi menangis)
- **Rekam Video Live (.webm)** — rekam dan unduh video langsung dari layar Live
- **Jurnal Perawatan & Kurva Tumbuh Kembang (KMS/WHO)** — catat ASI/susu, popok, suhu tubuh, berat/tinggi badan, lingkar kepala, dan checklist milestone perkembangan
- **Kunci Aplikasi PIN 4 Digit & Biometrik** — proteksi layar saat aplikasi dibuka (Keamanan & Privasi)
- **Ekspor Data CSV & Unggah Foto Bayi** — unduh riwayat kejadian + perawatan ke file CSV dan pasang foto profil si kecil
- **Sinkronisasi 2 Perangkat & Backend FastAPI** — sinkronisasi *stream* + alarm antar tab/perangkat dan dukungan penuh endpoint PRD (`/health`, `/ingest/frame`, `/ingest/heartbeat`, `/v1/notify`, `/v1/test-alarm`, `/v1/status`)
- Panel Simulasi (pengganti hardware): picu tangisan, tengkurap, muntah, napas, kamera/internet mati, demo otomatis, atau aktifkan kamera asli

## Menjalankan Backend FastAPI (Sesuai PRD)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Cek status di `http://127.0.0.1:8000/health` atau hubungkan langsung dari aplikasi melalui menu **Perangkat → Sinkronisasi 2 Tab / Perangkat**.

## Struktur
```
app/
  index.html, manifest.webmanifest, sw.js (PWA)
  css/styles.css
  js/store.js    state (localStorage) → nanti diganti API FastAPI
  js/camera.js   kamera DUMMY (canvas) → nanti diganti player stream WebRTC/HLS
  js/engine.js   mesin AI SIMULASI → nanti diganti hasil Cloud AI (/v1/notify)
  js/audio.js    sirene, TTS, lagu tidur
  js/app.js      router, alarm, toast/sheet
  js/screens.js  semua layar
  js/sim.js      panel simulasi + boot
```

## Menjadi APK / iOS (Capacitor)
```bash
npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "AI Baby Monitor" id.aibabymonitor.app --web-dir app
npx cap add android && npx cap add ios
npx cap open android   # build APK di Android Studio
npx cap open ios       # build di Xcode (butuh Mac + akun Apple Developer)
```
Untuk produksi tambahkan: push notification (FCM/APNs), plugin background audio, dan ganti modul dummy di atas dengan backend asli.

Harga paket di aplikasi hanya contoh.
