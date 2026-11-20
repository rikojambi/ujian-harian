# Pengujian aturan keamanan

## Menjalankan tes

```bash
npm run test:rules
```

Perintah menjalankan Firebase Emulator hanya untuk Firestore dan test runner Node:

```text
firebase emulators:exec --only firestore --project demo-ujian-harian \
  "node --test tests/rules.test.mjs"
```

Persyaratan:

- Java 17+ terpasang dan ada di PATH (firebase-tools 15 akan menyarankan Java 21+).
- Port `8085` bebas. Port ini ditentukan di `firebase.json` dan `tests/rules.test.mjs`.
- Tidak perlu project Firebase nyata; tes memakai project demo `demo-ujian-harian`.

## Yang diuji

| Tes | Memastikan |
| --- | --- |
| Guru baca kunci, siswa tidak | `questions` hanya untuk guru/admin. |
| Soal siswa sesuai penugasan | `student_questions` hanya terbaca jika assignment ada. |
| Ujian sesuai penugasan | Siswa tidak bisa menebak `exams` lain dari daftar. |
| Gate pembahasan | `student_explanations` tertutup sampai `revealAtMs` lewat. |
| Result tidak bisa ditulis siswa | `exam_results`, attempt, dan kunci tidak bisa diubah siswa. |
| Jawaban hanya saat ujian berjalan | Siswa bisa koreksi jawaban sebelum submit, tidak setelahnya. |
| Attempt hanya untuk ujian ditugaskan | Siswa tidak bisa membuat attempt ujian lain. |
| Akun tanpa profil | Pengguna tanpa dokumen `users/{uid}` ditolak. |

## Desain isolasi kunci

1. `questions` berisi `correctAnswers`, `explanation`, dan opsi dengan `isCorrect`. Hanya guru/admin yang membaca koleksi ini.
2. `exam_questions` menyimpan `answerKey` untuk penilaian guru, juga hanya guru/admin.
3. `buildStudentQuestionDoc()` membuat `student_questions` tanpa kunci.
4. `buildStudentQuestionDoc()` juga membuat `student_explanations` yang hanya terbaca setelah publication gate.
5. `startAttempt()` membaca opsi dari `student_questions`, bukan dari `questions`.
6. `buildStudentAnalysis()` memakai `exam_results`, `student_questions`, jawaban sendiri, `exams`, dan `objectives`; tidak pernah membaca kunci mentor.
7. `gradeAttempt()`/skrip `score` menghitung nilai di sisi guru/server dan menulis ke `exam_results`. Siswa hanya bisa membaca hasil yang sudah dipublikasikan.

## Pemeriksaan manual di browser

1. Login sebagai siswa contoh, buka daftar ujian: hanya ujian yang ditugaskan yang muncul.
2. Coba akses langsung koleksi/kunci melalui developer tools: tidak boleh terbaca.
3. Kerjakan, simpan jawaban, refresh halaman: jawaban harus kembali dari autosave.
4. Submit, lalu cek nilai belum muncul sebelum guru mempublikasikan.
5. Login sebagai guru, nilai/publikasikan; atur `explanationMode` sesuai kebutuhan.
6. Login lagi sebagai siswa: nilai muncul, pembahasan hanya muncul setelah jendela publishing terbuka.

## Catatan aturan Firestore

- Peran dibaca dari custom claim `role` bila tersedia, dengan fallback ke `users/{uid}.role`. Skrip Admin SDK (`bootstrap:admin`, `users:create`, `users:role`) menulis keduanya. Setelah `users:role`, pengguna perlu masuk ulang agar claim baru aktif.
- `publications/{examId}_{studentId}` harus memiliki `revealAtMs` berupa angka (milliseconds).
- `exam_attempts` tidak boleh diubah siswa menjadi `published`; hanya status `in_progress → submitted` yang diizinkan.
- Koleksi `credentials` ditutup total di aturan Firestore; kredensial lokal hanya untuk IndexedDB.
