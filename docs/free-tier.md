# Estimasi penggunaan paket gratis Firebase

Angka kuota Firebase dapat berubah; cek kembali di [halaman harga Firebase](https://firebase.google.com/pricing) dan Firebase Console → Usage. Estimasi berikut adalah perkiraan untuk paket **Spark** dan bukan jaminan kuota.

## Layanan yang dipakai

| Layanan | Digunakan untuk | Catatan Spark |
| --- | --- | --- |
| Authentication | Login email/password | Umumnya tersedia di Spark; pantau jumlah akun. |
| Cloud Firestore | Semua data aplikasi | Paling sensitif terhadap jumlah baca/tulis. |
| Cloud Storage | Opsional, jika media diunggah | Default aplikasi memakai URL eksternal sehingga Storage bisa tetap kosong. |
| Hosting | SPA + service worker | Transfer bulanan terbatas; aset di-cache browser. |

## Perkiraan konsumsi Firestore

Setiap kali halaman memuat daftar (misalnya daftar soal, ujian, siswa), aplikasi menjalankan kueri Firestore. Beberapa halaman memuat satu koleksi penuh.

Contoh kasus: 1 ujian, 40 siswa, 30 soal.

| Aktivitas | Perkiraan operasi |
| --- | --- |
| Guru buka daftar soal | ~30 reads |
| Guru buat ujian + 30 link + 30 mirror | ~61 writes |
| 40 siswa buka daftar ujian | ~40 reads + assignment/attempt lookup |
| 40 siswa mulai ujian | ~40 reads soal + ~40 writes attempt |
| Autosave 5 kali per siswa | ~200 writes |
| Submit 40 siswa | ~40 writes attempt + ~200 writes jawaban |
| Penilaian + publikasi | ~40 reads/writes hasil + 40 publication writes + analisis |
| Analisis butir | ~30 reads/writes |

Untuk skala ini, total masih jauh di bawah kuota harian Spark yang biasanya puluhan ribu reads/writes. Risiko muncul jika:

- banyak siswa membuka halaman berulang kali dengan refresh manual,
- daftar koleksi besar dimuat tanpa filter,
- autosave terlalu agresif,
- seed data dijalankan berulang di lingkungan produksi.

## Rekomendasi agar tetap di Spark

- Aktifkan Filtering/where di halaman dengan data besar; hindari memuat seluruh koleksi.
- Simpan media di Google Drive/CDN sekolah (`VITE_MEDIA_MODE=external`), bukan di Storage/Firestore.
- Jangan menyimpan Base64 gambar di dokumen Firestore.
- Gunakan `npm run score -- --exam EXAM_ID` sekali setelah semua attempt selesai, bukan pada setiap perubahan jawaban.
- Batasi jumlah ujian aktif dan periode retensi jawaban lama.
- Pantau Firebase Console → Firestore → Usage setiap minggu.
- Ekspor laporan dan arsipkan data lama sesuai kebijakan sekolah.

## Kapan perlu naik paket

Pertimbangkan Blaze jika:

- lebih dari beberapa ratus siswa aktif per hari,
- memerlukan ekspor Firestore otomatis terjadwal,
- ingin Cloud Functions untuk notifikasi/penilaian realtime,
- membutuhkan backup otomatis dan pemantauan lanjutan.

Aplikasi ini sengaja tidak memakai Cloud Functions agar tetap bisa di-deploy di Spark. Penilaian tepercaya dilakukan lewat skrip Admin SDK yang dijalankan di komputer/CI.
