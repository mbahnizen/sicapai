# Deployment Guide — SiCAPAI ke Google Cloud Run

> Target: URL publik untuk demo #JuaraVibeCoding (deadline 31 Mei 2026)  
> Firebase Project: `sicapai-mbahnizen` | Region: `asia-southeast2` (Jakarta)

---

## Prasyarat

1. **Google Cloud SDK** — [install](https://cloud.google.com/sdk/docs/install)
2. **Docker Desktop** — [install](https://docs.docker.com/desktop/install/windows-install/)
3. Sudah login ke gcloud:
   ```bash
   gcloud auth login
   gcloud config set project sicapai-mbahnizen
   ```

---

## Langkah 1 — Aktifkan API yang dibutuhkan

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

---

## Langkah 2 — Buat Artifact Registry repository

```bash
gcloud artifacts repositories create sicapai-repo \
  --repository-format=docker \
  --location=asia-southeast2 \
  --description="SiCAPAI Docker images"
```

Auth Docker dengan registry:
```bash
gcloud auth configure-docker asia-southeast2-docker.pkg.dev
```

---

## Langkah 3 — Build & Push Docker image

Dari folder project (`c:\laragon\www\my-projects\SiCAPAI`):

```bash
# Build image
docker build -t asia-southeast2-docker.pkg.dev/sicapai-mbahnizen/sicapai-repo/sicapai:latest .

# Push ke Artifact Registry
docker push asia-southeast2-docker.pkg.dev/sicapai-mbahnizen/sicapai-repo/sicapai:latest
```

---

## Langkah 4 — Firebase Service Account

Pilih salah satu opsi:

### Opsi A: JSON sebagai env var (lebih simpel)

1. Buka [Firebase Console](https://console.firebase.google.com) → Project `sicapai-mbahnizen`
2. Project Settings → Service Accounts → **Generate new private key**
3. Download file JSON → simpan di luar folder project (jangan di dalam!)
4. Konversi ke single-line string:
   ```bash
   # PowerShell
   (Get-Content service-account.json -Raw) -replace "`r`n|`n", " "
   ```
5. Simpan hasilnya — akan dipakai di Langkah 5 sebagai `FIREBASE_SERVICE_ACCOUNT`

### Opsi B: Application Default Credentials (lebih aman, tanpa JSON)

```bash
# Ambil nomor project
gcloud projects describe sicapai-mbahnizen --format="value(projectNumber)"

# Ganti PROJECT_NUMBER dengan hasilnya
gcloud projects add-iam-policy-binding sicapai-mbahnizen \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/firebase.admin"
```

Dengan Opsi B, tidak perlu set `FIREBASE_SERVICE_ACCOUNT` — Cloud Run otomatis pakai ADC.

---

## Langkah 5 — Deploy ke Cloud Run

### Jika pakai Opsi A (JSON env var):

```bash
gcloud run deploy sicapai \
  --image asia-southeast2-docker.pkg.dev/sicapai-mbahnizen/sicapai-repo/sicapai:latest \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=sicapai-mbahnizen,GEMINI_API_KEY=ISI_API_KEY_KAMU"
```

Lalu tambahkan `FIREBASE_SERVICE_ACCOUNT` via Console (lebih mudah untuk JSON panjang):
- Cloud Run Console → Service `sicapai` → Edit & Deploy New Revision → Variables & Secrets
- Tambahkan `FIREBASE_SERVICE_ACCOUNT` → paste isi JSON dalam satu baris

### Jika pakai Opsi B (ADC):

```bash
gcloud run deploy sicapai \
  --image asia-southeast2-docker.pkg.dev/sicapai-mbahnizen/sicapai-repo/sicapai:latest \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=sicapai-mbahnizen,GEMINI_API_KEY=ISI_API_KEY_KAMU"
```

---

## Langkah 6 — Tambahkan URL ke Firebase Auth

Setelah deploy berhasil, Cloud Run akan memberikan URL seperti:  
`https://sicapai-xxxxxx-et.a.run.app`

**Wajib dilakukan agar Google Login bekerja:**

1. [Firebase Console](https://console.firebase.google.com) → Authentication → **Settings** → Authorized domains
2. Klik **Add domain** → masukkan `sicapai-xxxxxx-et.a.run.app`

3. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client IDs → pilih client yang dipakai
4. Tambahkan ke **Authorized JavaScript origins**: `https://sicapai-xxxxxx-et.a.run.app`
5. Tambahkan ke **Authorized redirect URIs**: `https://sicapai-xxxxxx-et.a.run.app/__/auth/handler`

---

## Langkah 7 — Verifikasi

```bash
# Health check
curl https://sicapai-xxxxxx-et.a.run.app/api/health

# Harusnya return:
# {"status":"ok","service":"SiCAPAI API","timestamp":"..."}
```

Buka URL di browser → login Google → pastikan semua fitur berjalan.

---

## Re-deploy setelah update kode

```bash
docker build -t asia-southeast2-docker.pkg.dev/sicapai-mbahnizen/sicapai-repo/sicapai:latest . && \
docker push asia-southeast2-docker.pkg.dev/sicapai-mbahnizen/sicapai-repo/sicapai:latest && \
gcloud run deploy sicapai \
  --image asia-southeast2-docker.pkg.dev/sicapai-mbahnizen/sicapai-repo/sicapai:latest \
  --region asia-southeast2
```

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `Google login popup blocked` | Pastikan Cloud Run URL sudah di Firebase Authorized Domains |
| `401 Token tidak valid` | Pastikan `FIREBASE_PROJECT_ID` benar di env vars |
| `Gemini error 429` | `GEMINI_API_KEY` salah atau kuota habis — cek di AI Studio |
| `Container failed to start` | Lihat logs: `gcloud run logs read --service=sicapai --region=asia-southeast2` |
| Build gagal di `npm run build` | Pastikan semua file di `.dockerignore` tidak dibutuhkan saat build |
