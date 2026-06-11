<div align="center">
  <img src="public/favicon.svg" width="72" alt="SiCAPAI" />

  <h1>SiCAPAI</h1>
  <p><strong>Sistem Catatan Capaian Anak</strong></p>
  <p>Generator narasi rapor PAUD/TK berbasis AI — hemat waktu, hasil lebih konsisten, dan terasa manusiawi.</p>

  [![Deploy ke Cloud Run](https://github.com/mbahnizen/sicapai/actions/workflows/deploy.yml/badge.svg)](https://github.com/mbahnizen/sicapai/actions/workflows/deploy.yml)
  [![Lisensi: MIT](https://img.shields.io/badge/Lisensi-MIT-blue.svg)](LICENSE)
  [![Node.js 24](https://img.shields.io/badge/Node.js-24-green.svg)](https://nodejs.org)

</div>

---

## Tentang SiCAPAI

Guru PAUD/TK di Indonesia menghabiskan berjam-jam menulis narasi rapor secara manual untuk puluhan siswa — dengan kata-kata yang sering kali berulang dan tidak mencerminkan perkembangan unik setiap anak.

**SiCAPAI** hadir untuk menyelesaikan masalah itu. Guru cukup mencentang capaian perkembangan anak berdasarkan Kurikulum Merdeka, lalu sistem akan menyusun narasi rapor yang kohesif dan personal — dengan bantuan AI sebagai pemoles akhir, bukan pengganti penilaian guru.

> Penilaian tetap milik guru. AI hanya membantu merangkai kata.

---

## Fitur Utama

- **Checklist capaian terstruktur** — 3 elemen kurikulum (Agama & Budi Pekerti, Jati Diri, Literasi & STEAM), 4 tingkat capaian (BB / MB / BSH / BSB)
- **Narasi otomatis dari template** — dihasilkan instan dari pilihan indikator, tanpa AI
- **Poles dengan AI** — satu klik untuk menyempurnakan narasi menjadi lebih mengalir dan natural
- **Indikator ibadah adaptif** — sub-indikator otomatis menyesuaikan agama siswa (Islam, Kristen, Katolik, Hindu, Buddha, Konghucu)
- **Tambah siswa massal** — input tabel interaktif, bisa langsung paste dari Excel/Google Sheets
- **Ekspor rapor** — format `.docx` siap cetak per siswa, atau `.xlsx` rekap seluruh kelas
- **Multi-instansi** — satu akun guru bisa mengelola lebih dari satu sekolah/kelas
- **Quota AI transparan** — guru tahu sisa kuota generasi AI yang tersedia

---

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | Vanilla JS + Vite (ES Modules, tanpa framework) |
| Backend | Node.js + Express 5 |
| Database | Firestore (Firebase Admin SDK) |
| Auth | Firebase Authentication (Google OAuth) |
| AI | Google Gemini 2.5 Flash |
| Hosting | Google Cloud Run (Jakarta, `asia-southeast2`) |
| CI/CD | GitHub Actions + Workload Identity Federation |

---

## Menjalankan Lokal

### Prasyarat

- Node.js 24+
- Akun Firebase dengan Firestore aktif
- Gemini API key (gratis di [Google AI Studio](https://aistudio.google.com))

### Langkah

```bash
# 1. Clone repositori
git clone https://github.com/mbahnizen/sicapai.git
cd sicapai

# 2. Install dependensi
npm install

# 3. Buat file .env dari contoh
cp .env.example .env
# Edit .env — isi GEMINI_API_KEY dan FIREBASE_PROJECT_ID

# 4. Letakkan service-account.json Firebase di folder server/
#    (Firebase Console → Project Settings → Service Accounts → Generate new private key)

# 5. Jalankan dev server (frontend + backend bersamaan)
npm run dev:all
```

Frontend berjalan di `http://localhost:5173`, backend di `http://localhost:3000`.

---

## Konfigurasi Environment

| Variabel | Keterangan |
|---|---|
| `GEMINI_API_KEY` | API key Gemini dari Google AI Studio |
| `FIREBASE_PROJECT_ID` | Project ID Firebase |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path ke `service-account.json` (dev lokal) |
| `FIREBASE_SERVICE_ACCOUNT` | Isi JSON service account (Cloud Run, satu baris) |
| `PORT` | Port server, default `3000` |
| `NODE_ENV` | `development` atau `production` |

---

## Deploy

Deployment dijalankan otomatis oleh GitHub Actions setiap kali ada push ke branch `main`.

Pipeline:
1. GitHub Actions mengautentikasi ke GCP via **Workload Identity Federation** (tanpa JSON key)
2. Kode di-build menggunakan **Cloud Build** (Dockerfile multi-stage: Vite build → Node.js production)
3. Image di-push ke **Artifact Registry**
4. **Cloud Run** diperbarui dengan revision baru

Untuk setup awal atau deploy manual, lihat [dokumentasi Cloud Run](https://cloud.google.com/run/docs).

---

## Struktur Proyek

```
sicapai/
├── server/                  # Backend Express
│   ├── middleware/          # Auth & Firestore init
│   ├── routes/              # API endpoints (students, reports, AI, dll.)
│   └── services/            # Gemini AI & quota service
├── src/                     # Frontend (Vite)
│   ├── components/          # UI components (app shell, checklist, preview)
│   ├── config/              # Firebase client config
│   ├── data/                # Data kurikulum JSON
│   ├── services/            # API client, template engine, export
│   └── styles/              # CSS global & komponen
├── public/                  # Aset statis
├── Dockerfile               # Multi-stage build
└── vite.config.js
```

---

## Lisensi

[MIT](LICENSE) — bebas digunakan, dimodifikasi, dan didistribusikan.
