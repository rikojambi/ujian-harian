# Instalasi dan konfigurasi

## Persyaratan

- Node.js 20 LTS atau lebih baru (Vite 6).
- npm 10+.
- Opsional: Java 17+ (disarankan 21+) untuk Firebase Emulator dan `npm run test:rules`.
- Akun Firebase dengan paket **Spark** untuk produksi.

## 1. Instal dependensi

```bash
npm install
```

## 2. Mode Lokal (tanpa Firebase)

Biarkan semua variabel `VITE_FIREBASE_*` kosong. Jalankan:

```bash
npm run dev
```

Aplikasi menampilkan label **Mode Lokal**. Data tersimpan di IndexedDB per browser/perangkat. Gunakan **halaman Masuk → Muat data contoh** untuk mencoba alur lengkap. Tombol **Hapus data contoh** tersedia di halaman `/setup` jika ingin mulai bersih.

Data contoh dibuat sekali (penanda `meta/sample-data`) dan dapat dihapus kapan saja. Kredensial lokal hanya disimpan di IndexedDB, bukan Firestore.

## 3. Mode Firebase

### 3.1 Buat project Firebase

1. Buat project Firebase baru di konsol Firebase.
2. Tambahkan aplikasi web, salin konfigurasi ke `.env`.
3. Aktifkan **Authentication → Sign-in method → Email/Password**.
4. Buat database **Cloud Firestore** dan **Cloud Storage**.
5. Aktifkan **Hosting** jika ingin deploy.

Salin contoh environment:

```bash
cp .env.example .env
```

Isi minimal:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=proyek.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=proyek
VITE_FIREBASE_STORAGE_BUCKET=proyek.firebasestorage.app
VITE_FIREBASE_APP_ID=1:...:web:...
```

Variabel Admin SDK (`GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`) **hanya** dipakai oleh skrip Node dan tidak boleh diberi prefiks `VITE_` karena `VITE_` diedit ke bundle browser.

### 3.2 Deploy aturan dan indeks

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Firebase CLI tersedia sebagai devDependency, sehingga bisa dipanggil lewat `npx firebase ...` jika tidak dipasang global.

Port emulator Firestore sengaja memakai **8085** agar tidak bentrok dengan server lokal lain. Nilai ini ada di `firebase.json`, `.env.example`, dan `tests/rules.test.mjs`.

### 3.3 Buat admin awal

Siapkan service account dengan peran **Firebase Admin SDK Administrator Service Agent** atau owner, lalu:

```bash
# GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json npm run bootstrap:admin
npm run bootstrap:admin
```

Secara default skrip memakai email/password dari `BOOTSTRAP_ADMIN_*` di `.env`. Setelah admin dibuat, hapus `BOOTSTRAP_ADMIN_PASSWORD` dari `.env`.

Buat akun guru/siswa:

```bash
npm run users:create -- guru@sekolah.sch.id Guru123! "Nama Guru" teacher
npm run users:create -- siswa@sekolah.sch.id Siswa123! "Nama Siswa" student KELAS_ID NIS
npm run users:list
```

`users:create` membuat akun Authentication, dokumen `users/{uid}`, dan custom claim `role` sekaligus. Aturan Firestore memakai claim bila tersedia dengan fallback ke dokumen `users`. Jangan hanya membuat akun di Authentication tanpa menjalankan skrip ini. Setelah `users:role`, pengguna perlu masuk ulang agar claim baru aktif.

Menonaktifkan/mengaktifkan akun:

```bash
npm run users:disable -- siswa@sekolah.sch.id
npm run users:enable -- siswa@sekolah.sch.id
```

`users:disable` menandai akun sebagai `disabled` di Firebase Auth dan menulis `active: false` di `users/{uid}`. Login diblokir, dan aturan Firestore langsung menolak akses meskipun token lama masih berlaku. Karena itu, tombol nonaktif di halaman Kelola Akun sengaja tidak melakukan apa pun dalam Mode Firebase — aplikasi menampilkan perintah yang harus dijalankan lewat Admin SDK.

### 3.4 Data contoh Firebase (opsional)

```bash
npm run seed:firestore
```

Skrip ini idempoten dan membuat akun/admin/guru/siswa contoh beserta ujian. **Jangan jalankan di produksi** kecuali untuk uji penerimaan; hapus dokumen contoh sebelum dipakai nyata.

### 3.5 Media

Default `VITE_MEDIA_MODE=external`: URL Google Drive/CDN/server sekolah disimpan di Firestore, file tidak diunggah ke Storage. Jika `local`, file kecil disimpan sementara di IndexedDB browser dan tidak sinkron antarperangkat. Atur batas melalui `VITE_MAX_IMAGE_BYTES`, `VITE_MAX_AUDIO_BYTES`, `VITE_MAX_VIDEO_BYTES`, dan `VITE_MAX_VIDEO_SECONDS`.

## 4. Verifikasi

```bash
npm run test
npm run test:rules
npm run build
```

Lalu jalankan `npm run dev` dan coba login sebagai admin, guru, dan siswa.

## Masalah umum

| Gejala | Penyelesaian |
| --- | --- |
| Aplikasi tetap Mode Lokal | Pastikan keempat variabel `VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID` terisi, lalu restart dev server. |
| `Could not spawn java -version` | Pasang Java 17+ dan pastikan `java` ada di PATH; buka terminal baru setelah instalasi. |
| Rule test gagal `Unsupported method PUT` | Port 8085 dipakai proses lain. Tutup proses tersebut atau ubah port di `firebase.json` **dan** `tests/rules.test.mjs`. |
| Siswa tidak melihat ujian | Pastikan dokumen `exam_assignments/{examId}_{studentId}` ada dan `users/{uid}.role` bernilai `student`. |
| Pembahasan tidak muncul | Periksa dokumen `publications/{examId}_{studentId}` dan `revealAtMs` sudah lebih kecil dari waktu saat ini. |
