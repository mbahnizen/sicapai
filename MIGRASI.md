# Migrasi SiCAPAI dari Cloud Run ke Vercel

**Dibuat:** 24 Agustus 2026
**Alasan:** Billing GCP mati — seluruh akun billing Nizen berstatus tertutup (trial habis),
sehingga service Cloud Run masih ada dan `Ready=True` tapi ditolak melayani (**503**).

**Kabar baik: lapisan datanya selamat.** Sudah diperiksa pada 24 Agu 2026 —
Firestore `(default)` di `sicapai-paud` masih ada (FIRESTORE_NATIVE, asia-southeast2) dan
Firebase Auth handler mengembalikan **200**. Jadi memindahkan aplikasi ke Vercel **tidak
kehilangan data pengguna**; hanya lapisan komputasinya yang pindah.

---

## Yang Sudah Disiapkan

| Berkas | Fungsi |
| :--- | :--- |
| `vercel.json` | Build Vite → `dist/`, arahkan `/api/*` dan `/__/auth/*` ke fungsi, sisanya SPA fallback |
| `api/index.js` | Entrypoint serverless — mengimpor ulang app Express yang sudah ada |
| `server/index.js` | Diberi penjaga: `app.listen()` dilewati saat `process.env.VERCEL` ada |

**Docker dan Cloud Run tetap berfungsi.** Penjaga itu hanya aktif di Vercel, jadi kalau nanti
billing GCP hidup lagi, `Dockerfile` masih bisa dipakai tanpa perubahan.

Sudah diuji lokal (24 Agu 2026):

- `npm run build` → sukses, 41 modul, `dist/` terisi.
- `VERCEL=1 node -e "import('./api/index.js')"` → keluar sendiri (**tidak** membuka port). ✅
- Tanpa `VERCEL` → tetap mencetak `🎓 SiCAPAI server running on port 3000`. ✅

---

## Environment Variable yang Wajib Diisi di Vercel

Ambil dari `.env` lokal. **Jangan pernah commit nilai-nilai ini.**

| Variable | Nilai | Catatan |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | dari [aistudio.google.com](https://aistudio.google.com) | Gratis, 1500 request/hari. **Tidak butuh billing** — inilah kenapa migrasi ini bisa tanpa kartu. |
| `FIREBASE_PROJECT_ID` | `sicapai-paud` | |
| `FIREBASE_SERVICE_ACCOUNT` | isi `server/service-account.json` sebagai **JSON satu baris** | Kode sudah mendukung ini (Opsi B di `.env.example`) — di Cloud Run pun begitu. |
| `NODE_ENV` | `production` | Mengaktifkan CSP di helmet. |

### Variabel build-time frontend (jangan dilewati)

Enam variabel di bawah dibaca **Vite saat build**, bukan saat request. Kalau kosong,
`src/config/firebase.js` menghasilkan config berisi `undefined`, build tetap "sukses",
tapi aplikasi gagal inisialisasi Firebase di browser — halaman terbuka, login mati.
Isi di Vercel untuk environment **Production** (dan Preview kalau dipakai) **sebelum**
deploy pertama; kalau ditambahkan belakangan, wajib redeploy karena nilainya sudah
ter-inline ke bundel.

Ambil semuanya dari `.env` lokal:

| Variable | Catatan |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Isi dengan `<nama-proyek>.vercel.app`**, lihat catatan di bawah. |
| `VITE_FIREBASE_PROJECT_ID` | `sicapai-paud` |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |

> **Kenapa `VITE_FIREBASE_AUTH_DOMAIN` diisi domain Vercel, bukan `*.firebaseapp.com`?**
> Kode memilih auth domain begini:
>
> ```js
> const authDomain = _hostname.endsWith('.run.app') ? _hostname : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
> ```
>
> Di Cloud Run, cabang pertama membuat auth berjalan lewat domain aplikasi sendiri, dan
> `server/index.js` mem-proxy `/__/auth/*` ke Firebase. Di Vercel hostname berakhiran
> `.vercel.app`, jadi jatuh ke cabang kedua. Mengisi variabel ini dengan domain Vercel
> mempertahankan alur yang sama persis — dan `vercel.json` sudah merutekan `/__/auth/*`
> ke fungsi serverless, sehingga proxy-nya tetap terpakai. **Tidak ada perubahan kode.**

> **Jangan** set `PORT` di Vercel — platformnya yang mengatur.
> **Jangan** pakai `GOOGLE_APPLICATION_CREDENTIALS` (Opsi A) di Vercel; itu menunjuk ke berkas
> yang tidak ikut ter-deploy. Pakai `FIREBASE_SERVICE_ACCOUNT`.

Mengubah `service-account.json` jadi satu baris:

```bash
node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('server/service-account.json','utf8'))))"
```

Salin keluarannya utuh ke Vercel → Settings → Environment Variables.

---

## Langkah Deploy

```bash
npm i -g vercel
vercel login
vercel link
```

Isi environment variable di atas lewat dashboard Vercel (lebih aman daripada CLI karena
`FIREBASE_SERVICE_ACCOUNT` panjang dan sensitif), lalu:

```bash
vercel --prod
```

---

## ⚠️ Satu Langkah yang Mudah Terlupa: Authorized Domain

Firebase Auth menolak login dari domain yang tidak terdaftar. Setelah dapat URL Vercel:

**Firebase Console → Authentication → Settings → Authorized domains → Add domain**
→ tambahkan `<nama-proyek>.vercel.app`.

Tanpa ini, aplikasi terbuka normal tapi **login Google gagal** dengan `auth/unauthorized-domain`.

> Proxy `/__/auth` di `server/index.js` meneruskan ke `sicapai-paud-a293b.firebaseapp.com`,
> dan itu sudah diverifikasi **200** pada 24 Agu 2026 — jadi bagian ini tidak perlu diubah.

---

## Verifikasi Setelah Deploy

```bash
BASE="https://<nama-proyek>.vercel.app"
curl -s -o /dev/null -w "root   : %{http_code}\n" -L --max-time 30 "$BASE/"
curl -s --max-time 30 "$BASE/api/health"   # harus: {"status":"ok","service":"SiCAPAI API",...}
```

`/api/health` adalah rute tanpa auth, jadi ini bukti paling cepat bahwa fungsi serverless-nya hidup.

Lalu uji manual di browser:

1. **Login dengan Google** → membuktikan authorized domain sudah benar.
2. **Generate satu narasi** → membuktikan `GEMINI_API_KEY` terpasang dan rute AI jalan.
3. **Muat daftar siswa/lembaga** → membuktikan `FIREBASE_SERVICE_ACCOUNT` valid dan Firestore terbaca.

Kalau langkah 3 gagal tapi 1 berhasil, hampir pasti `FIREBASE_SERVICE_ACCOUNT` salah format
(biasanya `\n` di `private_key` rusak saat disalin).

## Setelah Terbukti 200

- [ ] Perbarui `homepage` repo GitHub ke URL Vercel.
- [ ] Perbarui tabel **Ringkasan Status Link** di `CV-Nizen-Iskandar/data-lengkap-nizen/Portofolio Github Nizen.md`
      (ubah 🔴 DOWN → 🟢 200 dan tanggal ceknya).
- [ ] Perbarui `README.md`, `DEPLOY.md`, dan `DEPLOY_CHECKLIST.md` — ketiganya masih menjelaskan
      alur Cloud Run.
- [ ] Baru setelah itu, link demo boleh dicantumkan lagi di CV.
