# SiCAPAI — Handover Document
> Dibuat: 2026-05-13. Diperbarui: 2026-05-15 (auth GIS, header export, UI polish). Baca ini sebelum mulai sesi baru.

---

## Apa ini?

SiCAPAI (Sistem Catatan Capaian Anak) adalah web app untuk guru TK/PAUD.
Alur utama: Login → pilih instansi → pilih siswa → centang indikator capaian → narasi otomatis terbentuk → opsional dipercantik AI (Gemini) → salin ke clipboard atau finalisasi sebagai dokumen rapor.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS SPA (no framework), Vite |
| Auth | Firebase Auth (Google OAuth) |
| Backend | Express.js (Node), ES Modules |
| Database | Firestore (Firebase Admin SDK) |
| AI | Gemini 2.5 Flash (`@google/genai` v2.2.0) |
| Hosting | Laragon (dev) — Cloud Run (target prod) |

**Entry point frontend:** `src/main.js`  
**Entry point backend:** `server/index.js`

---

## Arsitektur Data Firestore

| Koleksi | Key / Dokumen | Isi |
|---|---|---|
| `institutions` | auto-id | name, address, inviteCode, createdBy |
| `institution_members` | `{instId}_admin_{uid}` atau auto | institutionId, userId, role |
| `students` | auto-id | name, nickname, gender, ageGroup, religion, institutionId, createdBy |
| `progress` | `{uid}_{studentId}` | selectedIndicators, aiResult, semester, year, savedAt |
| `reports` | auto-id | snapshot final rapor (terhubung ke UI via Finalisasi) |
| `quotas` | `{uid}` | weeklyUsed, weekStart, totalLifetime |

**Penting:** `progress` di-scope per guru (`uid`), bukan per instansi. Dua guru di instansi sama punya dokumen progress sendiri-sendiri → tidak ada konflik.

---

## File Map (yang penting)

```
src/
  main.js                          ← Bootstrap app, auth gate
  services/
    api.js                         ← Semua HTTP call ke backend (dengan auth token)
    auth.js                        ← Firebase Auth wrapper
    template-engine.js             ← Logika generate narasi dari indikator (pure JS)
    report-export.js               ← printReport() via hidden iframe + window.print()
    report-export-docx.js          ← downloadReportAsDocx() — unduh DOCX via `docx` package
    report-xlsx.js                 ← exportInstitutionToXlsx() — XLSX Mail Merge 2 sheet
  components/
    layout/
      app-shell.js                 ← Komponen terbesar: sidebar siswa + panel laporan
                                     Termasuk: openReportViewerModal, openCopyCapaianModal,
                                     renderAchievementState, promptManageInstitution
    report/
      checklist.js                 ← Komponen checklist accordion 4-level
      preview.js                   ← Komponen preview narasi + per-section AI buttons
                                     + AI version bar (Baku / #1 / #2 ...)
    auth/
      login-screen.js              ← Halaman login Google
    shared/
      toast.js, modal.js           ← UI utilities

server/
  index.js                         ← Express setup, daftar semua routes
  middleware/auth.js               ← Firebase token verification, checkMembership
  routes/
    ai.js                          ← POST /api/generate-ai (quota check + Gemini)
    institutions.js                ← CRUD instansi + join + PUT edit + DELETE leave
    students.js                    ← CRUD siswa
    reports.js                     ← Simpan/ambil rapor final + GET /institution/:id
    progress.js                    ← Simpan/ambil/hapus progress per guru per siswa
    quota.js                       ← GET kuota AI user
  services/
    gemini.js                      ← Prompt Gemini (LOCKED), parse JSON response
    quota.js                       ← Cek & kurangi kuota (Firestore)
```

---

## Fitur yang Sudah Selesai ✅

### Layout & UX
- [x] Dua kolom scroll independen (desktop): checklist kiri, preview kanan — scroll independen
- [x] Mobile: student list sebagai horizontal chip strip di atas, main content di bawah
- [x] Grouping siswa per Kelompok A/B di sidebar
- [x] Loading spinner berhenti ketika siswa belum dipilih (empty state)
- [x] Semester meta row rapi di mobile (grid layout)
- [x] Opsi semester dipersingkat: "Smt. 1" / "Smt. 2"
- [x] Header bersih — nama instansi saja, invite code dipindah ke modal Kelola Instansi
- [x] Scroll preview dipreservasi saat re-render (tidak flash ke atas setiap centang)
- [x] Narasi flash highlight (desktop >1024px) pada section yang baru berubah saat centang,
      diikuti smooth scroll ke section pertama yang berubah
- [x] **Sidebar mobile scroll hint** — `mask-image` gradient fade di sisi kanan chip strip;
      tanpa markup tambahan, cukup CSS untuk sinyal "ada lebih banyak di kanan"
- [x] **Login screen overhaul** — split layout cinematic (gelap kiri, putih kiri overlay -52px),
      mockup mini "narasi sebagai produk" (quote believable + chip glassmorphism floating),
      chip `position:absolute` di pojok kanan mockup dengan `backdrop-filter: blur(14px)`

### Onboarding & Empty State
- [x] Empty state setelah buat instansi: tombol "➕ Tambah Siswa Pertama" langsung (bukan hanya teks)
- [x] Auto-select siswa pertama setelah ditambahkan jika instansi sebelumnya kosong
- [x] Hint pada field "Nama Panggilan" (dipakai di narasi AI) dan "Agama" (memengaruhi indikator ibadah)

### Core Feature
- [x] Checklist 4-level: Elemen → Sub-Elemen → Indikator → Sub-Indikator
- [x] Template engine: narasi terbentuk otomatis, dipisah per sub-elemen (multi-paragraf, `\n\n`)
- [x] Preview dengan `white-space: pre-wrap` → paragraf terbaca jelas
- [x] Per-section AI button: tiap dari 3 elemen (Agama, Jati Diri, STEAM) punya tombol AI sendiri
- [x] AI version bar per section: `[📝 Baku] [✨ #1] [✨ #2]` — rollback atau lanjut tanpa kehilangan hasil
- [x] Auto-revert narasi ke Baku saat checklist section berubah (konten AI sudah tidak relevan)
- [x] Backward compat: `seedAiHistory()` — progress lama yang belum punya history tetap bisa rollback
- [x] AI quota: 20x/minggu per user, ditampilkan di header — kuning/merah jika ≤3 sisa
- [x] "Salin Semua" — copy semua narasi ke clipboard dengan label per elemen
- [x] Filter sub-indikator `gerakan-ibadah` berdasarkan agama siswa
- [x] Copy Capaian — salin indikator dari satu siswa ke siswa lain (modal multi-select)
- [x] Rename siswa (nama lengkap + nama panggilan) via ✏️ edit button di sidebar
- [x] Tombol "🔄 Mulai Ulang" — reset semua indikator dan AI untuk siswa; disabled jika 0 indikator

### AI Feature (Gemini)
- [x] Gemini API bekerja penuh dengan model `gemini-2.5-flash`
- [x] API key: AI Studio free tier (1500 req/hari) — **tidak pakai Google Cloud billing**
- [x] Layered Prompt Architecture: Core Persona + Section Persona per elemen
- [x] Few-shot behavioral examples di CORE_PERSONA (❌/✅ pairs)
- [x] Per-section pedagogical personas: `agama-budi-pekerti`, `jati-diri`, `literasi-steam`
- [x] Retry logic: 3 attempt, delay [1000, 2500, 5000]ms, status [429, 500, 503, 529]
- [x] `maxOutputTokens: 8192` (cukup untuk 26+ indikator)
- [x] Regex fallback untuk parse JSON dalam markdown code block
- [x] **Prompt LOCKED** — jangan ubah tanpa alasan kuat dan dataset test yang cukup

### Progress Persistence
- [x] Auto-save ke localStorage saat checkbox berubah (debounce 300ms)
- [x] Auto-save ke Firestore (fire-and-forget, non-blocking)
- [x] Restore progress saat siswa dipilih (localStorage → instant)
- [x] Background sync dari server: jika Firestore punya data lebih baru, UI di-update + toast
- [x] Tombol "💾 Simpan" + status "✓ Tersimpan HH:MM"
- [x] Delete progress via `DELETE /api/progress/:studentId` (dipakai oleh Mulai Ulang)

### Finalisasi & Arsip Rapor
- [x] Tombol "Finalisasi & Simpan" di preview — simpan snapshot ke koleksi `reports`
- [x] Achievement screen confetti setelah finalisasi berhasil
- [x] Achievement CTA: Primary "📂 Lihat Arsip Rapor", Secondary "➕ Lanjut ke Siswa Berikutnya"
      (urut sesuai sidebar: Kelompok A → B, tidak wrap)
- [x] Achievement: tawaran "Copy Capaian ke Siswa Lain" — muncul hanya jika ada siswa lain
- [x] Achievement: "⬇️ Unduh DOCX" — generate file Word (.docx) langsung di browser via `docx` package
- [x] Arsip Rapor — list rapor final per siswa (tombol "📂 Arsip")
- [x] Report Viewer Modal — tampilkan detail rapor final, per-section copy button
- [x] Cetak Dokumen — `printReport()` via hidden iframe, format A4 formal (LCPA)
      *(Cetak masih tersedia di archive modal; achievement panel sudah beralih ke DOCX)*
- [x] Export XLSX — unduh semua rapor final instansi sebagai data source Mail Merge Word
      (dua sheet: Semester 1 & Semester 2, satu baris per siswa per semester, data terbaru)

### Instansi — Kelola
- [x] Buat instansi (idempotency key untuk retry-safe)
- [x] Gabung via invite code (strip `#` otomatis, `maxlength=7`)
- [x] Edit nama/alamat instansi (creator only) — `PUT /api/institutions/:id`
- [x] Keluar dari instansi (non-creator) — `DELETE /api/institutions/:id/leave`
- [x] Hapus instansi permanen (creator only, danger zone)
- [x] Invite code tampil di modal Kelola Instansi (bukan di header) — `user-select:all` pada kode
- [x] **Gear settings dipindah ke institution picker** — tiap baris instansi punya tombol ⚙️ sendiri;
      `#btn-inst-settings` di header dihapus, tidak lagi muncul di workspace bar
- [x] **Header export button** — slot bekas gear diisi tombol ⬇️ (`#btn-export-xlsx`), muncul saat instansi dipilih;
      klik langsung trigger export XLSX tanpa masuk modal Kelola Instansi

### Auth & Security
- [x] `auth.authStateReady()` di `getIdToken()` → fix race condition "gagal klik pertama"
- [x] Loading screen gate di `main.js` → tidak ada halaman tampil sebelum Firebase konfirmasi auth
- [x] Semua API endpoint dilindungi `authMiddleware` (Firebase token verification)
- [x] `checkMembership()` di operasi sensitif
- [x] **GIS Migration** — Auth sepenuhnya pakai Google Identity Services, bukan Firebase `signInWithPopup`
      Primary: FedCM/One Tap (`google.accounts.id`) → Google tampilkan "SiCAPAI" dari consent screen
      Fallback: OAuth popup (`google.accounts.oauth2.initTokenClient`) → cross-browser (Firefox, Private Mode)
      Firebase `signInWithPopup` dihapus — Firebase domain tidak pernah muncul ke user

---

## Yang Belum Ada / Potensial Sesi Berikutnya

### 1. Deployment ke Cloud Run ✅ FILE SIAP — tinggal eksekusi
`Dockerfile`, `.dockerignore`, dan panduan lengkap sudah ada di `DEPLOY.md`.
Baca `DEPLOY.md` dari awal — ada 7 langkah, estimasi 30–60 menit untuk pertama kali.

File yang dibuat/diubah untuk deployment:
- `Dockerfile` — multi-stage: Node 22 builder (Vite build) + production image (Express)
- `.dockerignore` — exclude `.env`, `node_modules`, `dist`, service account files
- `server/middleware/auth.js` — tambah support `FIREBASE_SERVICE_ACCOUNT` env var JSON string
- `.env.example` — dokumentasi semua env var yang dibutuhkan
- `DEPLOY.md` — panduan step-by-step termasuk Firebase Authorized Domains

**Yang masih harus dilakukan secara manual (butuh akses akun):**
- Download Firebase service account key (Firebase Console → Project Settings → Service Accounts)
- `gcloud run deploy` dengan env vars yang benar
- Tambahkan Cloud Run URL ke Firebase Authorized Domains
- Tambahkan Cloud Run URL ke Google OAuth authorized origins

### 2. Verifikasi Data Kurikulum
File `src/data/kurikulum.json` berisi semua indikator. Perlu verifikasi apakah data sudah lengkap dan akurat sesuai Kurikulum Merdeka untuk TK/PAUD.

---

## Hal Teknis yang Perlu Diingat

### Gemini API Key — AI Studio, bukan Google Cloud
Gunakan key dari https://aistudio.google.com (gratis, 1500 req/hari).
**Jangan** pakai Google Cloud Console — billing trial tidak support Gemini API.
Key saat ini ada di `.env` sebagai `GEMINI_API_KEY`.

### Prompt LOCKED — jangan ubah sembarangan
`server/services/gemini.js` — prompt sudah di-tune melalui 10+ iterasi.
Arsitektur: CORE_PERSONA (few-shot) + SECTION_PERSONAS (per elemen).
Perubahan butuh dataset test yang cukup agar tidak regresi ke gaya evaluatif.

### Quota tracking ada di DUA tempat
- **Server** (`server/services/quota.js`): sumber kebenaran, Firestore, direset tiap Senin
- **Client** (`state.quota.weeklyUsed`): hanya untuk update UI realtime dalam sesi, tidak persisten
- Saat app load, `api.getQuota()` dipanggil parallel dengan `api.getInstitutions()` — fix race condition quota selalu 20/20 setelah hard refresh

### Progress vs Reports — dua koleksi berbeda
- `progress` = draft kerja aktif guru (bisa diedit terus, per guru per siswa)
- `reports` = snapshot final rapor (immutable setelah disimpan)

### AI History — session-only, tidak persisted ke Firestore
`state.aiHistory` hanya hidup selama sesi browser. `state.aiResult` tetap persisted ke localStorage/Firestore (backward compat).
`seedAiHistory()` di-call setiap kali `state.aiResult` di-restore (dua tempat: `renderMainPanel` dan `syncProgressFromServer`) untuk populate version bar dari data lama.

### onGenerateAI harus throw
Di `app-shell.js`, `onGenerateAI` untuk quota habis dan no-template melakukan `throw` setelah `showToast`.
Ini disengaja agar tombol AI di `preview.js` bisa restore `disabled=false` di blok `catch`.
Jangan ubah menjadi `return` saja.

### Cross-device sync: savedAt harus dari server
`server/routes/progress.js` menyimpan `savedAt: Date.now()` (bukan client-provided).
Client membandingkan `serverData.savedAt > localSavedAt` untuk tahu apakah server lebih baru.

### Mulai Ulang memanggil renderMainPanel
Reset handler **harus** memanggil `renderMainPanel(state, container)` setelah reset state — bukan `renderChecklist(..., () => {})`.
Versi lama dengan callback kosong menyebabkan checklist tidak bisa memperbarui preview setelah reset.

### Scroll preservation di renderPreview
`renderPreview()` menyimpan `scrollTop` dari `.preview-body` sebelum `container.innerHTML = ...` dan me-restore-nya synchronously sesudahnya.
Ini mencegah preview "flash ke atas" setiap kali checkbox dicentang atau AI selesai generate.

### Narasi highlight animation — desktop only
CSS `@keyframes narrativeFlash` di-guard dengan `@media (min-width: 1025px)`.
JS trigger juga di-guard: `if (window.innerWidth > 1024)`.
Breakpoint 1024px cocok dengan breakpoint CSS `.report-panels` yang collapse ke single-column.

### DOCX export — browser-side via `docx` package
`report-export-docx.js` menggunakan `docx` npm package (v8.x) + `Packer.toBlob()`.
Tidak perlu server — file dibuat di browser dan langsung di-download.
`printReport()` tetap ada di `report-export.js` untuk "Cetak" di archive/history modal.

### white-space: pre-wrap di tiga tempat
- `.preview-narrative` di `preview.js` → preview panel edit
- `.rv-section-text` di `app-shell.js` → report viewer modal
- `section-body` di `report-export.js` → print/PDF
Kalau ada tampilan teks narasi baru, pastikan property ini ada.

### Rute institution reports — urutan penting
Di `server/routes/reports.js`, route `GET /institution/:institutionId` harus ditempatkan **sebelum** `GET /:studentId`.
Keduanya berbeda kedalaman path (2 vs 1 segment) tapi Express matching memerlukan urutan yang benar.

### GIS — dua path auth, satu `AuthService`
`src/services/auth.js` punya dua path sign-in:
- **FedCM** (`_handleIdToken`): `GoogleAuthProvider.credential(idToken, null)` — token dari One Tap
- **OAuth popup** (`_signInWithOAuthPopup`): `GoogleAuthProvider.credential(null, accessToken)` — token dari `initTokenClient`

Keduanya ujungnya ke `signInWithCredential()`. `_gisReady` flag mengontrol path mana yang dipakai.
`initOneTap()` masih ada sebagai alias deprecated untuk backward compat.

### `markInputError` — clear saat `input`, bukan `focus`
`markInputError()` di `app-shell.js` meng-clear class `input-error` pada event `input` (keystroke pertama), **bukan** `focus`.
Menggunakan `focus` menyebabkan error hilang saat user klik field lain lalu balik — sebelum mengetik apapun.
CSS juga punya selector eksplisit `.form-input.input-error:focus` (specificity 0,3,0) agar green focus ring tidak override red border.

### `btn-danger-ghost` — class untuk tombol destruktif outline
`src/styles/components.css` punya class `.btn-danger-ghost` untuk tombol seperti "Keluar dari Instansi".
Background transparan + border merah + hover tint merah. Jangan pakai `btn-ghost` untuk ini — hover-nya inject mint background dari `--primary-light`.

### Header export button — dua entry point export XLSX
Export XLSX kini bisa dipanggil dari dua tempat:
1. **Header** (`#btn-export-xlsx`) — via `setupInstitutionSettings()`, langsung pakai `state.currentInstitution`
2. **Modal Kelola Instansi** (`#btn-export-xlsx-modal`) — ID berbeda untuk hindari duplikat, simpan `origHTML` lalu restore via `innerHTML`
ID yang berbeda penting — jangan rename jadi sama karena keduanya bisa ada di DOM bersamaan.
