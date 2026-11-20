# Deployment produksi

## 1. Build

```bash
npm install
npm run check   # unit test + rule test + build
```

Atau, jika Java belum tersedia:

```bash
npm run test
npm run build
```

Hasil build ada di `dist/`, termasuk `sw.js`, manifest, ikon, dan `offline.html`.

## 2. Deploy Firebase (Spark Plan)

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage,hosting
```

Atau deploy semuanya:

```bash
npx firebase deploy
```

Konfigurasi Hosting di `firebase.json` melakukan rewrite semua rute ke `index.html` (SPA), men-set `Cache-Control: no-cache` untuk `sw.js`, dan `immutable` untuk aset di `assets/`.

Untuk domain kustom, tambahkan di Firebase Hosting → Custom domains dan gunakan HTTPS (wajib untuk PWA dan Web Crypto).

## 3. Variabel lingkungan

- Variabel `VITE_FIREBASE_*` tertanam di bundle dan bersifat publik. Jangan pernah memasukkan service account atau kata sandi admin di sini.
- Kredensial Admin SDK hanya untuk skrip Node (`bootstrap:admin`, `users:*`, `seed:firestore`, `score`, `backup:firestore`, `restore:firestore`). Simpan di `.env` lokal atau secret CI.
- Gunakan service account terpisah dengan hak minimum yang memungkinkan; jangan commit `.env` atau file JSON kunci.

Contoh CI (GitHub Actions) untuk deploy: gunakan `FIREBASE_SERVICE_ACCOUNT_JSON` dari repository secret, jalankan `npm ci`, `npm run build`, lalu `npx firebase deploy --only hosting` dengan `--project` yang ditentukan.

## 4. Checklist sebelum produksi

- [ ] Firebase Auth dengan Email/Password aktif.
- [ ] Firestore rules, indexes, dan Storage rules sudah di-deploy.
- [ ] Admin awal dibuat dengan `npm run bootstrap:admin`; kata sandi default diganti.
- [ ] Akun guru/siswa dibuat via Admin SDK dan memiliki dokumen `users/{uid}` dengan peran benar.
- [ ] Data contoh Firebase tidak dipakai/dihapus.
- [ ] Media memakai URL eksternal yang dapat diakses siswa (atau mode local hanya untuk perangkat tunggal).
- [ ] Uji siswa hanya melihat ujian yang ditugaskan.
- [ ] Uji pembahasan terkunci sebelum `revealAtMs`.
- [ ] Uji ekspor laporan dan instalasi PWA di Android/Windows.
- [ ] Cadangan awal dibuat (`npm run backup:firestore -- --out backups/awal.json`).

## 5. Alur pembaruan PWA

Service worker memakai `registerType: 'prompt'`. Saat build baru tersedia, aplikasi menampilkan konfirmasi **“Versi aplikasi baru tersedia. Muat ulang sekarang?”**. Setelah pengguna menerima, halaman dimuat ulang dan aset baru dipakai. Pastikan header `sw.js` tetap `no-cache` agar pembaruan terdeteksi.

## 6. Penilaian tepercaya

Guru dapat menilai dari UI, tetapi untuk jejak audit yang lebih kuat jalankan:

```bash
npm run score -- --exam EXAM_ID
npm run score -- --exam EXAM_ID --publish
```

Skrip Admin SDK menghitung ulang nilai, analisis butir, dan (opsional) publikasi beserta gate pembahasan. Gunakan `--force` hanya jika ingin mempublikasikan ulang hasil yang sudah ada.
