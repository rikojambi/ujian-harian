# Cadangan dan pemulihan

## Strategi yang kompatibel dengan Spark

Firebase console menyediakan ekspor Firestore terkelola, tetapi penjadwalan ekspor biasanya memerlukan paket berbayar. Proyek ini menyediakan skrip Admin SDK yang bekerja pada Spark karena hanya membaca/menulis dokumen melalui API Firestore.

### Membuat cadangan

```bash
# Semua koleksi
npm run backup:firestore

# Lokasi tertentu
npm run backup:firestore -- --out backups/2026-11-20.json

# Hanya koleksi tertentu
npm run backup:firestore -- --collections=users,exams,exam_results
npm run backup:firestore -- --exclude=audit_logs
```

File JSON berisi:

```json
{
  "format": "ujian-harian-firestore-backup",
  "version": 1,
  "createdAt": "...",
  "projectId": "...",
  "collections": {
    "users": [{ "id": "uid", "data": { "...": "..." } }]
  }
}
```

Firestore `Timestamp` dikodekan sebagai `{ "__timestamp__": "ISO-8601" }` agar tidak berubah menjadi objek biasa saat JSON disimpan.

### Memulihkan

```bash
# Merge default: aman untuk dokumen yang sudah ada
npm run restore:firestore -- backups/2026-11-20.json

# Timpa isi dokumen yang ada
npm run restore:firestore -- backups/2026-11-20.json --overwrite

# Hanya koleksi tertentu
npm run restore:firestore -- backups/2026-11-20.json --collections=users,exams
```

Catatan penting:

- Restore **tidak menghapus** dokumen yang tidak ada di backup.
- Mode default memakai `merge: true`; gunakan `--overwrite` hanya jika Anda memang ingin mengganti seluruh isi dokumen.
- Uji restore di project emulator/staging sebelum produksi.
- Simpan backup di lokasi terenkripsi dan batasi aksesnya; backup berisi data pribadi siswa.

## Ekspor laporan

Untuk kebutuhan administrasi, guru/admin juga dapat mengekspor data yang sudah dirapikan melalui menu laporan:

- **XLSX** — beberapa sheet (nilai, analisis butir, penguasaan TP).
- **CSV** — satu sheet untuk dibuka di spreadsheet.
- **PDF** — ringkasan siap cetak.

Ekspor ini bukan pengganti cadangan lengkap karena tidak menyimpan seluruh dokumen sistem.

## Cadangan Mode Lokal

Mode Lokal menyimpan data di IndexedDB browser. Tidak ada backup server. Sebelum menghapus data browser atau berpindah perangkat:

1. Ekspor laporan yang dibutuhkan dari menu Guru/Admin.
2. Jika memungkinkan, salin URL/media eksternal yang dipakai soal.
3. Catat bahwa kredensial lokal tidak dapat dipulihkan dari Firestore; buat ulang akun setelah Mode Lokal diisi ulang.

Disarankan memakai Mode Lokal hanya untuk evaluasi, bukan sebagai penyimpanan resmi.
