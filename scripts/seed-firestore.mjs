import { initAdmin, stamp } from './lib/admin.mjs';

const ACTOR = 'seed-firestore';
const YEAR_ID = 'th-2026-2027';
const CLASS_ID = 'kelas-xi-tkj-1';
const SUBJECT_ID = 'mapel-pbo';
const BANK_ID = 'bank-pbo-xi';
const EXAM_ID = 'ujian-contoh-pbo';
const STUDENT_UID = 'siswa-contoh-uid';
const TEACHER_UID = 'guru-contoh-uid';
const ADMIN_UID = 'admin-contoh-uid';

const ACCOUNTS = [
  { uid: ADMIN_UID, email: 'admin@ujianharian.local', password: 'Admin123!', name: 'Administrator', role: 'admin' },
  { uid: TEACHER_UID, email: 'guru@ujianharian.local', password: 'Guru123!', name: 'Bu Rina', role: 'teacher' },
  { uid: STUDENT_UID, email: 'siswa@ujianharian.local', password: 'Siswa123!', name: 'Andi Pratama', role: 'student' }
];

const options = (keys, correct) => keys.map((key) => ({
  id: `opsi-${key}`, key, text: `Opsi ${key}`, isCorrect: correct.includes(key)
}));

const QUESTIONS = [
  {
    id: 'soal-1', code: 'PBO-001', type: 'multiple_choice', prompt: 'Manakah yang merupakan sifat utama pemrograman berorientasi objek?',
    options: options(['A', 'B', 'C', 'D'], ['B']), correctAnswers: ['B'], acceptedAnswers: [], explanation: 'Enkapsulasi menyatukan data dan perilaku dalam satu unit.',
    difficulty: 'mudah', weight: 20, gradingMethod: 'exact_match', whitespaceTolerance: 'collapse_all', requiresManualReview: false
  },
  {
    id: 'soal-2', code: 'PBO-002', type: 'multiple_choice', prompt: 'Kata kunci untuk mendefinisikan kelas dalam Java adalah …',
    options: options(['A', 'B', 'C', 'D'], ['A']), correctAnswers: ['A'], acceptedAnswers: [], explanation: 'Kelas didefinisikan dengan kata kunci class.',
    difficulty: 'mudah', weight: 20, gradingMethod: 'exact_match', whitespaceTolerance: 'collapse_all', requiresManualReview: false
  },
  {
    id: 'soal-3', code: 'PBO-003', type: 'multiple_response', prompt: 'Pilih dua prinsip OOP!',
    options: options(['A', 'B', 'C', 'D'], ['A', 'C']), correctAnswers: ['A', 'C'], acceptedAnswers: [], explanation: 'Enkapsulasi dan polimorfisme adalah prinsip OOP.',
    difficulty: 'sedang', weight: 20, gradingMethod: 'exact_match', whitespaceTolerance: 'collapse_all', requiresManualReview: false
  },
  {
    id: 'soal-4', code: 'PBO-004', type: 'completion', prompt: 'Proses menyembunyikan detail implementasi disebut …',
    options: [], correctAnswers: ['enkapsulasi'], acceptedAnswers: ['enkapsulasi', 'encapsulation'], explanation: 'Enkapsulasi menyembunyikan detail internal objek.',
    difficulty: 'sedang', weight: 20, gradingMethod: 'exact_match', whitespaceTolerance: 'collapse_all', requiresManualReview: false
  },
  {
    id: 'soal-5', code: 'PBO-005', type: 'multiple_choice', prompt: 'Apa kepanjangan dari ORM?',
    options: options(['A', 'B', 'C', 'D'], ['C']), correctAnswers: ['C'], acceptedAnswers: [], explanation: 'Object Relational Mapping memetakan objek ke tabel relasional.',
    difficulty: 'sukar', weight: 20, gradingMethod: 'exact_match', whitespaceTolerance: 'collapse_all', requiresManualReview: false
  }
];

const SAMPLE_ANSWERS = [
  { questionId: 'soal-1', answer: ['B'] },
  { questionId: 'soal-2', answer: ['A'] },
  { questionId: 'soal-3', answer: ['A', 'D'] },
  { questionId: 'soal-4', answer: ['enkapsulasi'] },
  { questionId: 'soal-5', answer: ['B'] }
];

async function ensureAuthUser(auth, account) {
  try {
    return await auth.getUser(account.uid);
  } catch {
    return auth.createUser({ uid: account.uid, email: account.email, password: account.password, displayName: account.name });
  }
}

async function main() {
  const { auth, db } = initAdmin();
  for (const account of ACCOUNTS) {
    await ensureAuthUser(auth, account);
    await db.collection('users').doc(account.uid).set({
      uid: account.uid, email: account.email, name: account.name, role: account.role,
      active: true, ...stamp(ACTOR)
    }, { merge: true });
  }
  await db.collection('teachers').doc(TEACHER_UID).set({
    uid: TEACHER_UID, name: 'Bu Rina', email: 'guru@ujianharian.local',
    subjectIds: [SUBJECT_ID], classIds: [CLASS_ID], active: true, ...stamp(ACTOR)
  }, { merge: true });
  await db.collection('students').doc(STUDENT_UID).set({
    uid: STUDENT_UID, name: 'Andi Pratama', email: 'siswa@ujianharian.local',
    nis: '2026001', classId: CLASS_ID, active: true, ...stamp(ACTOR)
  }, { merge: true });

  await db.collection('academic_years').doc(YEAR_ID).set({
    name: '2026/2027', semester: 'ganjil', startDate: '2026-07-01', endDate: '2027-06-30',
    active: true, ...stamp(ACTOR)
  }, { merge: true });
  await db.collection('classes').doc(CLASS_ID).set({
    name: 'XI TKJ 1', level: 'XI', major: 'Teknik Komputer dan Jaringan',
    academicYearId: YEAR_ID, homeroomTeacherId: TEACHER_UID, active: true, ...stamp(ACTOR)
  }, { merge: true });
  await db.collection('subjects').doc(SUBJECT_ID).set({
    name: 'Pemrograman Berorientasi Objek', code: 'PBO', active: true, ...stamp(ACTOR)
  }, { merge: true });
  await db.collection('enrollments').doc(`${STUDENT_UID}_${YEAR_ID}`).set({
    studentId: STUDENT_UID, classId: CLASS_ID, academicYearId: YEAR_ID, active: true, ...stamp(ACTOR)
  }, { merge: true });
  await db.collection('learning_objectives').doc('tp-pbo-1').set({
    code: 'TP.PBO.1', description: 'Memahami konsep dasar OOP', subjectId: SUBJECT_ID,
    classId: CLASS_ID, academicYearId: YEAR_ID, semester: 'ganjil', material: 'Dasar OOP',
    active: true, ...stamp(ACTOR)
  }, { merge: true });
  await db.collection('question_banks').doc(BANK_ID).set({
    name: 'Bank PBO Kelas XI', subjectId: SUBJECT_ID, classId: CLASS_ID, academicYearId: YEAR_ID,
    semester: 'ganjil', teacherId: TEACHER_UID, active: true, ...stamp(ACTOR)
  }, { merge: true });

  const batch = db.batch();
  for (const question of QUESTIONS) {
    batch.set(db.collection('questions').doc(question.id), {
      ...question, bankId: BANK_ID, subjectId: SUBJECT_ID, classId: CLASS_ID,
      academicYearId: YEAR_ID, semester: 'ganjil', material: 'Dasar OOP',
      learningObjectiveIds: ['tp-pbo-1'], stimulus: '', media: [], explanationMedia: [],
      status: 'active', teacherId: TEACHER_UID, tags: ['contoh'], ...stamp(ACTOR)
    }, { merge: true });
  }
  await batch.commit();

  const start = new Date(Date.now() - 3600_000).toISOString();
  const end = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
  await db.collection('exams').doc(EXAM_ID).set({
    name: 'Ujian Harian PBO - Dasar OOP', description: 'Contoh ujian untuk mencoba seluruh alur aplikasi.',
    subjectId: SUBJECT_ID, classId: CLASS_ID, academicYearId: YEAR_ID, semester: 'ganjil',
    startAt: start, endAt: end, durationMinutes: 30, randomizeQuestions: false, randomizeOptions: false,
    maxAttempts: 1, navigationMode: 'free', autosave: true, showResultImmediately: false,
    status: 'active', teacherId: TEACHER_UID, totalWeight: 100, questionCount: QUESTIONS.length,
    passingScore: 70, explanationMode: 'on_publish', ...stamp(ACTOR)
  }, { merge: true });

  const examBatch = db.batch();
  for (const [order, question] of QUESTIONS.entries()) {
    examBatch.set(db.collection('exam_questions').doc(`${EXAM_ID}_${question.id}`), {
      examId: EXAM_ID, questionId: question.id, order: order + 1, weight: question.weight,
      answerKey: question.correctAnswers, type: question.type,
      learningObjectiveIds: ['tp-pbo-1'], ...stamp(ACTOR)
    }, { merge: true });
    examBatch.set(db.collection('student_questions').doc(`${EXAM_ID}_${question.id}`), {
      examId: EXAM_ID, questionId: question.id, order: order + 1, prompt: question.prompt,
      type: question.type, weight: question.weight, options: question.options,
      learningObjectiveIds: ['tp-pbo-1'], ...stamp(ACTOR)
    }, { merge: true });
    examBatch.set(db.collection('student_explanations').doc(`${EXAM_ID}_${question.id}`), {
      examId: EXAM_ID, questionId: question.id, correctAnswers: question.acceptedAnswers.length ? question.acceptedAnswers : question.correctAnswers,
      explanation: question.explanation, explanationMedia: [], ...stamp(ACTOR)
    }, { merge: true });
  }
  examBatch.set(db.collection('exam_assignments').doc(`${EXAM_ID}_${STUDENT_UID}`), {
    examId: EXAM_ID, studentId: STUDENT_UID, classId: CLASS_ID, assignedBy: TEACHER_UID,
    attemptCount: 1, ...stamp(ACTOR)
  }, { merge: true });
  await examBatch.commit();

  const attemptId = 'attempt-contoh-1';
  const submittedAt = new Date().toISOString();
  await db.collection('exam_attempts').doc(attemptId).set({
    examId: EXAM_ID, studentId: STUDENT_UID, assignmentId: `${EXAM_ID}_${STUDENT_UID}`,
    attemptNumber: 1, status: 'published', startedAt: new Date(Date.now() - 1800_000).toISOString(),
    submittedAt, finishedAt: submittedAt, timeSpentSeconds: 900,
    questionOrder: QUESTIONS.map((question) => question.id), optionOrder: {},
    currentQuestionIndex: QUESTIONS.length, flaggedQuestionIds: [], ...stamp(ACTOR)
  }, { merge: true });

  const answerBatch = db.batch();
  const evaluations = [];
  for (const [index, sample] of SAMPLE_ANSWERS.entries()) {
    const question = QUESTIONS[index];
    answerBatch.set(db.collection('exam_answers').doc(`${attemptId}_${question.id}`), {
      attemptId, examId: EXAM_ID, studentId: STUDENT_UID, questionId: question.id,
      answer: sample.answer, markedForReview: false, answeredAt: submittedAt,
      updatedAtClient: submittedAt, synced: true, ...stamp(ACTOR)
    }, { merge: true });
    const correct = question.correctAnswers.every((key) => sample.answer.includes(key))
      && sample.answer.every((key) => question.correctAnswers.includes(key));
    evaluations.push({
      questionId: question.id,
      earned: correct ? question.weight : 0,
      max: question.weight,
      correct,
      needsManualReview: false
    });
  }
  await answerBatch.commit();

  const autoScore = evaluations.reduce((sum, item) => sum + item.earned, 0);
  const finalScore = Math.round(autoScore);
  await db.collection('exam_results').doc(attemptId).set({
    attemptId, examId: EXAM_ID, studentId: STUDENT_UID, classId: CLASS_ID, subjectId: SUBJECT_ID,
    answers: evaluations, autoScore, finalScore, maxScore: 100, passed: finalScore >= 70,
    gradedBy: TEACHER_UID, gradedAt: submittedAt, status: 'published',
    publishedAt: submittedAt, publishedBy: TEACHER_UID, ...stamp(ACTOR)
  }, { merge: true });
  await db.collection('publications').doc(`${EXAM_ID}_${STUDENT_UID}`).set({
    examId: EXAM_ID, studentId: STUDENT_UID, classId: CLASS_ID,
    studentIds: [STUDENT_UID], publishedBy: TEACHER_UID, publishedAt: submittedAt,
    explanationAvailableAt: submittedAt, revealAtMs: Date.now(), ...stamp(ACTOR)
  }, { merge: true });

  console.log('Data contoh berhasil ditanam (idempoten).');
  console.log('Akun: admin@ujianharian.local / Admin123!, guru@ujianharian.local / Guru123!, siswa@ujianharian.local / Siswa123!');
  console.log('Hapus data contoh manual dari Firestore sebelum produksi bila tidak diperlukan.');
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
