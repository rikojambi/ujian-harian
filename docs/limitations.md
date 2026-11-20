# Batasan dan catatan operasional

## Fungsional

- Tidak ada Cloud Functions. Pembuatan akun, penilaian tepercaya, dan backup dijalankan lewat skrip Admin SDK (`scripts/`).
- Penilaian dari browser guru tetap dimungkinkan, tetapi untuk jejak audit yang kuat gunakan `npm run score`.
- Data tidak realtime lintas klien. Daftar dimuat saat halaman dibuka; gunakan tombol refresh pada halaman yang menyediakannya atau muat ulang halaman.
- Jawaban offline disimpan sementara di IndexedDB dan baru sinkron saat koneksi kembali. Submit, penilaian, dan publikasi memerlukan koneksi internet pada mode Firebase.
- Mode Lokal hanya untuk satu browser/perangkat. Kredensial dan data tidak sinkron antarperangkat.

## Impor soal

- DOCX diproses dengan Mammoth: heading/paragraf dan teks terbaca, tetapi tabel/rumus kompleks tidak dijamin.
- Gambar pada DOCX hanya dikenali sebagai placeholder `[GAMBAR: nama]` dan tidak diunggah otomatis.
- Parser RTF hanya mengekstrak teks dan Unicode `\uN`; gambar, tabel, dan rumus RTF tidak diproses.
- Teks harus memakai pola nomor `1.`, `1)`, atau `Soal 1.`; opsi memakai `A.`, `A)`, sampai `E.`.
- Kunci dapat ditulis `Kunci Jawaban: A`, `Jawaban: A`, `Key: A`, atau untuk completion `Kunci: merah, kuning`.
- `TP:`/`Tujuan Pembelajaran:`/`LO:` dikenali sebagai kode TP dan akan dicocokkan dengan TP yang ada saat penyimpanan.
- Setiap hasil impor wajib ditinjau di preview sebelum disimpan.

## Media

- Default `external`: simpan URL Drive/CDN di Firestore. Pastikan tautan dapat dibuka siswa dan tidak memerlukan login pribadi guru.
- Mode `local` memakai IndexedDB; kapasitas bergantung browser dan bisa hilang jika data browser dihapus.
- Audio/video divalidasi berdasarkan ukuran dan durasi; kompresi gambar dilakukan di browser sebelum disimpan lokal.
- Jangan menaruh data URI/Base64 besar di dokumen Firestore.

## Statistik

- Analisis butir memerlukan sampel yang memadai. Aplikasi memberi catatan otomatis jika jumlah siswa < 10 atau reliabilitas dihitung dari < 20 peserta.
- KR-20 dipakai untuk skor dikotomis; Cronbach alpha untuk skor bertahap/parsial.
- Korelasi point-biserial dan estimasi signifikansi bersifat indikatif, bukan pengganti uji statistik formal.
- Analisis pengecoh hanya tersedia untuk pilihan ganda/multiple response.

## Keamanan

- Aturan Firestore memakai custom claim `role` bila ada, dengan fallback ke dokumen `users/{uid}`. Keduanya ditulis oleh skrip Admin SDK; peran yang diubah lewat konsol tanpa claim bisa tertunda hingga token pengguna diperbarui. Akun nonaktif (`active != true`) selalu ditolak meskipun claim masih ada.
- Siswa tidak boleh memiliki akses tulis ke `exam_results`, `item_analyses`, `publications`, `questions`, atau `student_explanations`.
- Jangan menaruh kunci layanan Firebase di variabel `VITE_*`.
- Data contoh bersifat publik dan kata sandinya diketahui; hapus sebelum produksi.

## Skalabilitas

- `useCollection` saat ini memuat hasil kueri ke memori browser tanpa pagination otomatis. Untuk sekolah besar, tambahkan filter/pagination sebelum memuat koleksi yang sangat besar.
- Ekspor XLSX dibuat di browser; dataset sangat besar dapat memperlambat perangkat.
- Firebase Spark memiliki batas harian; lihat [estimasi paket gratis](free-tier.md).
