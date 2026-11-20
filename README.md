# UJIAN HARIAN

Aplikasi Progresive Web App (PWA) untuk ujian harian SMK. Dirancang untuk berjalan pada **Firebase Spark Plan** (tanpa Cloud Functions/billing), dengan mode lokal berbasis IndexedDB agar aplikasi dapat dicoba tanpa konfigurasi Firebase.

## Fitur utama

- **Admin**: kelola tahun ajaran, mata pelajaran, kelas, pengguna, pengaturan, data contoh, cadangan/pemulihan Firestore.
- **Guru**: bank soal, impor DOCX/RTF/JSON dengan preview, media, TP, pembuatan dan penugasan ujian, penilaian manual, publikasi hasil, analisis butir, laporan XLSX/CSV/PDF.
- **Siswa**: melihat hanya ujian yang ditugaskan, mengerjakan dengan acak soal/opsi, autosave jawaban, submit sekali per attempt, melihat nilai dan pembahasan hanya setelah publikasi.

### Jenis soal dan penilaian

- Pilihan ganda, pilihan ganda multiple response (exact/partial credit), dan uraian singkat/completion.
- Penilaian otomatis + peninjauan manual; hasil tidak langsung terlihat siswa sebelum dipublikasikan.
- Analisis: indeks kesukaran, daya pembeda, korelasi point-biserial, KR-20/Cronbach alpha, analisis pengecoh, dan penguasaan TP siswa.

### Keamanan data

- Kunci jawaban dan pembahasan guru disimpan terpisah dari salinan soal siswa (`student_questions`, `student_explanations`).
- Siswa tidak dapat menulis `exam_results`, mengubah kunci, atau melihat soal ujian yang tidak ditugaskan.
- Pembahasan siswa hanya terbaca setelah dokumen `publications/{examId}_{studentId}` dengan `revealAtMs` terbuka.
- Pembuatan akun/produksi memakai skrip Admin SDK di server/local, bukan fungsi client.

## Arsitektur singkat

| Lapisan | Teknologi |
| --- | --- |
| UI | React 18, TypeScript, Vite 6, Tailwind CSS, React Router |
| Data | Firebase Auth + Firestore + Storage; fallback IndexedDB (`idb`) saat env Firebase kosong |
| Penilaian & statistik | Modul pure TypeScript di `src/services/scoring` dan `src/services/analytics` |
| Laporan | xlsx, jspdf, jspdf-autotable |
| Impor dokumen | mammoth (DOCX), parser RTF ringan, JSON |
| PWA | vite-plugin-pwa, service worker, offline fallback, prompt pembaruan |

## Mulai cepat

```bash
npm install
npm run dev
```

Jika variabel `VITE_FIREBASE_*` kosong, aplikasi berjalan dalam **Mode Lokal** (IndexedDB). Buka **halaman Masuk → Muat data contoh** untuk akun dan ujian contoh. Tombol **Hapus data contoh** tersedia di halaman `/setup`.

Akun contoh Mode Lokal:

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Admin | `admin@ujianharian.local` | `Admin123!` |
| Guru | `guru@ujianharian.local` | `Guru123!` |
| Siswa | `siswa@ujianharian.local` | `Siswa123!` |

Untuk memakai Firebase, salin `.env.example` menjadi `.env`, isi konfigurasi web app, lalu lihat [panduan instalasi](docs/installation.md).

## Skrip penting

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi +PWA |
| `npm run test` | Tes unit (Vitest) |
| `npm run test:rules` | Tes aturan Firestore di emulator (butuh Java) |
| `npm run check` | Unit test + rule test + build |
| `npm run bootstrap:admin` | Membuat admin awal via Admin SDK |
| `npm run users:create`, `users:list`, `users:role`, `users:password`, `users:disable`, `users:enable`, `users:delete` | Manajemen akun produksi via Admin SDK + custom claim `role` |

Di Mode Firebase, akun juga bisa dibuat langsung dari halaman **Kelola Akun**. Aplikasi memanggil Netlify Function `admin-accounts` yang menjalankan Admin SDK di server; variabel `FIREBASE_SERVICE_ACCOUNT_JSON` wajib diatur di Netlify. Function memverifikasi ID token admin dan menolak akun nonaktif.
| `npm run seed:firestore` | Data contoh Firebase (idempoten, hapus sebelum produksi) |
| `npm run score` | Penilaian/analisis/publikasi tepercaya via Admin SDK |
| `npm run backup:firestore`, `npm run restore:firestore` | Cadangan/pemulihan JSON Spark-friendly |

## Pengujian

```bash
npm run test        # 25 tes unit
npm run test:rules  # 8 tes aturan Firestore
npm run build
```

`npm run test:rules` membutuhkan Java 17+ (disarankan 21+) dan port `8085` bebas. Detail ada di [pengujian aturan](docs/security-testing.md).

## Dokumentasi

- [Instalasi dan konfigurasi](docs/installation.md)
- [Deployment produksi](docs/deployment.md)
- [Cadangan dan pemulihan](docs/backup-restore.md)
- [Pengujian aturan keamanan](docs/security-testing.md)
- [Estimasi paket gratis Firebase](docs/free-tier.md)
- [Batasan dan catatan operasional](docs/limitations.md)

## Status

Build produksi, tes unit, dan tes aturan Firestore telah dijalankan dan lulus. Lakukan smoke test alur admin/guru/siswa di lingkungan Anda sebelum dipakai secara akademik.
