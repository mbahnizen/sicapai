# Konteks Projek: SiCAPAI (Sistem Catatan Capaian Anak)

Dokumen ini berisi sintesis menyeluruh mengenai fakta-fakta, struktur, arsitektur, dan target dari projek **SiCAPAI**, yang didasarkan pada audit langsung terhadap *source code* dan dokumentasi eksisting (`HANDOVER.md`, `imp.md`, `JuaraVibeCoding.md`, `package.json`, dll).

---

## 1. Identitas Projek
* **Nama Projek:** SiCAPAI (Sistem Catatan Capaian Anak)
* **Tagline:** Asisten Cerdas Bunda PAUD
* **Deskripsi:** Aplikasi web berbasis AI yang dirancang untuk mempermudah guru PAUD/TK dalam menyusun narasi rapor atau Laporan Capaian Pembelajaran Anak (LCPA). Alur kerjanya meliputi pemilihan instansi, pemilihan siswa, mencentang indikator capaian, auto-generate template kalimat baku, dan opsi memoles narasi agar lebih hangat dan humanis menggunakan AI (Gemini).
* **Standar Kurikulum:** Kurikulum Merdeka Fase Fondasi (terdiri dari elemen Agama & Budi Pekerti, Jati Diri, dan Literasi & STEAM).

---

## 2. Target Utama User (The Goal)
Target utama dari pengembangan aplikasi ini adalah untuk diikutsertakan dan memenangkan ajang kompetisi **#JuaraVibeCoding** yang diselenggarakan oleh Google for Developers.

* **Target Tier:** Tier 2 — The Elite Architect (Top 100 Submission).
* **Deadline:** 31 Mei 2026.
* **Kewajiban Kompetisi:**
  1. Menggunakan AI dari Google (Google AI Studio / Gemini).
  2. Aplikasi harus di-deploy dan *live* di Google Cloud Run.
  3. Mengatasi masalah nyata dengan UX yang intuitif (Penilaian: Problem 30%, Solution 40%, Uniqueness 30%).

*Karena ditujukan untuk kompetisi, keputusan arsitektural sangat ditekankan pada showcase penggunaan layanan Google Cloud (Cloud Run, Firestore, Firebase, Gemini) secara optimal dan scalable.*

---

## 3. Tech Stack (Terkonfirmasi Existing)
Berdasarkan pengecekan struktur direktori, `package.json`, dan file-file di dalam `src/` serta `server/`, berikut adalah stack aktual yang digunakan:

| Layer | Teknologi | Bukti / Konfirmasi Codebase |
|---|---|---|
| **Frontend** | Vanilla JavaScript (ES Modules), Vite | Tidak ada React/Vue di `package.json`. *Entry point* di `src/main.js` dan komponen utamanya berada di `src/components/layout/app-shell.js`. |
| **Backend** | Node.js + Express.js | Direktori `server/index.js` menginisialisasi Express dengan routing (API gateway). Menggunakan `express-rate-limit` dan `helmet`. |
| **Authentication**| Firebase Authentication (Google OAuth) | `src/services/auth.js` untuk frontend dan `server/middleware/auth.js` untuk verifikasi JWT di backend. |
| **Database** | Firestore | Server menggunakan `firebase-admin` untuk berkomunikasi dengan Firestore (koleksi: institutions, students, progress, reports, quotas). |
| **AI Integration**| Gemini 2.0 Flash (`@google/genai`) | Diimplementasikan di `server/services/gemini.js` dengan prompt dinamis. |
| **Local Dev** | Laragon + Concurrently | Skrip `npm run dev:all` menjalankan Vite dan Node watch secara bersamaan. |

---

## 4. Arsitektur & Logika Sistem

1. **Pemisahan Logika (Client vs Server):** 
   - **Client-Side:** Mengelola UI, state, dan *Template Engine Baku*. Generator teks dari indikator yang dicentang sepenuhnya dieksekusi di *frontend* (`src/services/template-engine.js`). Hal ini memastikan responsivitas UI walaupun tanpa *hit* backend.
   - **Server-Side:** Berfungsi sebagai fasilitator keamanan (menyembunyikan API key), validasi JWT Firebase, Rate Limiting, manajer CRUD Firestore, dan eksekutor API Gemini.
2. **Multi-Tenant (Workspace):** Guru dapat memiliki atau bergabung dengan banyak instansi TK/PAUD (menggunakan *invite code* 7 karakter). Siswa dan progress dinavigasi di bawah scope instansi yang sedang aktif.
3. **Penyimpanan Draft (Progress Persistence):** 
   - Konteks progress di-scope per-guru per-siswa (untuk mencegah konflik jika 2 guru menilai 1 siswa yang sama).
   - Menyimpan *draft* seketika secara luring (ke `localStorage`) dan sinkronisasi di latar belakang ke Firestore. (Mekanisme *Race Condition Guards* telah diterapkan untuk mencegah render yang *glitchy* saat muat ulang halaman).
4. **Sistem Kuota AI:** Memiliki batas kuota 20 *request* per minggu, diikat ke `User ID` secara persisten di Firestore.

---

## 5. Status Fitur Terkini (Existing)

### ✅ Sudah Selesai & Berjalan:
* **Autentikasi & Proteksi Endpoint:** Login Google, pembatasan akses API menggunakan `authMiddleware`.
* **Workspace & Siswa:** Buat instansi, *join* dengan kode (termasuk fitur strip `#` otomatis), dan CRUD siswa.
* **UX Checklist Indikator:** 172 node indikator (4 level hierarki) yang dirender dinamis dari `sicapai_cp_indikator.json`. Tersedia logic filter otomatis (seperti indikator ibadah disesuaikan dengan agama siswa).
* **AI Enhancement:** Sinkronisasi hasil cetakan template baku dengan AI per-seksi (Agama, Jati Diri, STEAM), memotong kuota dan mengunci (*disable*) UI jika kuota habis.
* **Auto-Save & Background Sync:** Pembaruan UI *real-time* dengan penanda waktu *"✓ Tersimpan HH:MM"*.

### ⏳ Belum Tersedia / Target Iterasi Berikutnya:
Berdasarkan `HANDOVER.md` dan struktur API, fitur-fitur ini menjadi potensial untuk diselesaikan:
1. **Finalisasi Rapor:** Backend route (`/api/reports`) telah ada, namun *UI button* "Selesaikan Rapor" (menyimpan *snapshot* final/bukan sekadar draft) dan Halaman Riwayat Rapor belum diimplementasikan.
2. **Export & Print:** Belum ada fitur untuk mencetak (Print/PDF) atau mengekspor narasi ke dalam format Word (.docx). Saat ini hanya ada fitur "Salin Semua" ke *clipboard*.
3. **Reset Draft:** Tidak ada UI satu tombol untuk "Mulai Ulang" (menghapus paksa seluruh progress siswa), guru harus men-*uncheck* manual.
4. **Manajemen Instansi:** Guru belum bisa mengedit detail nama/alamat instansi, dan *member* belum bisa keluar (*leave*) dari instansi.
5. **Warning UI Kuota:** Notifikasi visual di antarmuka jika sisa kuota kritis (misal: ≤3) belum ada.

---

## Kesimpulan
SiCAPAI adalah aplikasi yang sudah berdiri dengan pondasi solid dan siap menyentuh tahapan akhir (*polish*). Arsitektur serverless (Firestore + Cloud Run) dan penggunaan GenAI sangat relevan dan *alignment* dengan metrik penilaian #JuaraVibeCoding. Langkah krusial berikutnya adalah menyelesaikan fitur export/cetak dan memastikan *deployment* yang stabil agar memenuhi final checklist kompetisi (Cloud Run Live URL + Demo Video).
