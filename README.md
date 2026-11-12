# AI Baby Monitor v3

**Live:** https://aibabymonitor.vercel.app

Ubah **dua HP** menjadi baby monitor: satu di kamar bayi sebagai **kamera**, satu di tangan orang tua sebagai **monitor dengan alarm**. Orang tua bisa tetap beraktivitas atau tidur nyenyak — HP akan berbunyi kalau si kecil menangis, gelisah, atau kalau kamera terputus.

Tanpa build, tanpa server sendiri: cukup file statis (HTML + CSS + ES modules).

## Cara pakai

1. **HP kamera bayi** (HP lama pun bisa): buka aplikasi → *Jadikan HP ini kamera bayi* → *Mulai kamera*. Letakkan 1–1,5 m dari boks dan colokkan charger.
2. **HP orang tua**: buka aplikasi → *HP ini untuk orang tua* → pindai QR di layar HP kamera (atau ketik kode + kunci 6 angka).
3. Malam hari, aktifkan **Mode tidur** di HP orang tua: layar hampir hitam tapi tetap menyala sehingga alarm pasti terdengar.

Belum punya HP kedua? Pilih **Coba dulu (mode demo)** — bayi simulasi dengan panel untuk memicu tangisan, tengkurap, dsb.

## Fitur

| | |
|---|---|
| **Kamera bayi ⇄ monitor (WebRTC)** | Video & suara langsung antar-HP (peer-to-peer). Beberapa HP orang tua bisa memantau satu kamera. Orang tanpa kunci ditolak. |
| **Deteksi di perangkat** | Tangisan (suara keras + bernada harmonis + nada dasar ≥ 280 Hz, agar kipas/AC/TV/obrolan tidak memicu alarm), gelisah & terbangun (gerakan piksel). |
| **Alarm** | Layar penuh, sirene/lonceng + suara Bahasa Indonesia, getar, notifikasi sistem, jam tenang. Alarm khusus bila **kamera terputus** atau **baterai kamera lemah**. |
| **Penenang otomatis** | White noise, detak jantung ibu, hujan, Nina Bobo, Brahms, Twinkle — diputar **di speaker HP kamera** saat bayi menangis; bisa juga dikendalikan manual + timer. |
| **Bicara ke bayi** | Tahan tombol untuk bicara (mikrofon HP orang tua → speaker kamera) atau putar kalimat siap pakai. |
| **Sesi tidur otomatis** | Tercatat saat bayi tenang beberapa menit; timeline 24 jam, grafik 7 hari dengan rentang anjuran sesuai usia. |
| **Jurnal** | Susu, popok, suhu, obat; tumbuh kembang dengan kurva berat badan vs median WHO; milestone; ekspor CSV & laporan PDF untuk dokter anak. |
| **Lainnya** | Mode gelap otomatis (18.00–06.00), kunci PIN (tersimpan sebagai hash), PWA bisa dipasang ke layar utama, rekam/foto/jendela mengambang. |

> Deteksi **tengkurap, muntah, dan napas** butuh model AI visi khusus (lihat PRD) sehingga saat ini hanya tersedia di mode demo.

## Batasan yang perlu diketahui

- Browser HP membatasi suara saat aplikasi ditutup/layar terkunci → gunakan **Mode tidur** di HP orang tua dan biarkan aplikasi kamera tetap terbuka.
- Koneksi memakai server signaling publik PeerJS (`0.peerjs.com`) hanya untuk "berkenalan"; video tidak lewat server. Sebagian jaringan seluler memblokir koneksi langsung — paling andal bila kedua HP di Wi-Fi yang sama. Untuk produksi, siapkan server PeerJS & TURN sendiri.
- Ini alat bantu pemantauan, **bukan alat medis** dan bukan pengganti pengawasan orang tua.

## Menjalankan di komputer

```bash
cd app
python3 -m http.server 8765
```
Buka http://localhost:8765. Kamera & mikrofon di HP memerlukan **HTTPS** (atau `localhost`), jadi untuk uji 2 HP gunakan versi yang sudah di-deploy ke Vercel.

## Struktur kode

```
app/
  index.html · manifest.webmanifest · sw.js (PWA, network-first)
  css/app.css               token tema → komponen → layar → overlay
  js/main.js                titik masuk: penjaga rute, tab bar, lanjutkan sambungan
  js/core/
    util.js                 format waktu Indonesia, wake lock, unduhan, dll.
    store.js                state tersimpan (localStorage) + data contoh + migrasi dari v1
    router.js               router hash (#/home, #/journal?tab=sleep) — tombol kembali berfungsi
    ui.js                   toast, bottom sheet, konfirmasi, tema, delegasi data-act / data-go
    bus.js · icons.js
  js/services/
    monitor.js              OTAK: bacaan sensor → status bayi → kejadian → sesi tidur
    detector.js             analisis mikrofon & kamera di perangkat (tangisan, gerakan)
    link.js                 WebRTC/PeerJS: pairing, video, perintah, tahan-untuk-bicara
    babyUnit.js             logika HP kamera bayi (kode pairing, baterai, perintah dari orang tua)
    alarm.js                layar alarm, sirene, notifikasi, penenang otomatis
    control.js              lagu/bicara/dengar diarahkan ke HP kamera atau lokal (demo)
    audio.js                sirene, TTS Bahasa Indonesia, lagu & white noise (Web Audio)
    sim.js                  bayi simulasi untuk mode demo
    feed.js                 menampilkan gambar kamera dari sumber aktif
  js/screens/               home, live, journal, babycam, night, setup, more, shared
backend/                    contoh API FastAPI sesuai PRD (untuk integrasi CCTV/gateway nanti)
```

## Backend FastAPI (opsional)

Contoh API sesuai PRD (`/health`, `/ingest/*`, `/v1/notify`, `/v1/test-alarm`, `/v1/status`) untuk integrasi kamera CCTV/gateway di masa depan. Aplikasi web v3 tidak membutuhkannya.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # ganti INGEST_TOKEN dengan nilai acak
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
