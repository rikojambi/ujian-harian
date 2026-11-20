import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-ujian-harian';
let env;

const now = () => new Date().toISOString();
const base = (extra = {}) => ({
  createdAt: now(), updatedAt: now(), createdBy: 'test', updatedBy: 'test', ...extra
});

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/admin1'), base({ uid: 'admin1', email: 'admin@test', name: 'Admin', role: 'admin', active: true }));
    await setDoc(doc(db, 'users/teacher1'), base({ uid: 'teacher1', email: 'guru@test', name: 'Guru', role: 'teacher', active: true }));
    await setDoc(doc(db, 'users/student1'), base({ uid: 'student1', email: 'siswa@test', name: 'Siswa', role: 'student', active: true }));
    await setDoc(doc(db, 'users/student2'), base({ uid: 'student2', email: 'siswa2@test', name: 'Siswa 2', role: 'student', active: true }));

    await setDoc(doc(db, 'exams/exam1'), base({
      examId: 'exam1', name: 'Ujian 1', teacherId: 'teacher1', status: 'active',
      classId: 'class1', passingScore: 70
    }));
    await setDoc(doc(db, 'exams/exam2'), base({
      name: 'Ujian 2', teacherId: 'teacher1', status: 'active',
      classId: 'class1', passingScore: 70
    }));
    await setDoc(doc(db, 'exam_assignments/exam1_student1'), base({
      examId: 'exam1', studentId: 'student1', classId: 'class1', assignedBy: 'teacher1', attemptCount: 0
    }));

    await setDoc(doc(db, 'questions/q1'), base({
      examId: 'exam1', prompt: 'Soal rahasia', correctAnswers: ['A'],
      explanation: 'Kunci A', options: [], teacherId: 'teacher1', status: 'active'
    }));
    await setDoc(doc(db, 'student_questions/exam1_q1'), base({
      examId: 'exam1', questionId: 'q1', order: 1, prompt: 'Soal siswa',
      type: 'multiple_choice', weight: 10, options: [{ id: 'o1', key: 'A', text: 'A' }]
    }));
    await setDoc(doc(db, 'student_explanations/exam1_q1'), base({
      examId: 'exam1', questionId: 'q1', correctAnswers: ['A'], explanation: 'Kunci A'
    }));
    await setDoc(doc(db, 'exam_attempts/attempt1'), base({
      examId: 'exam1', studentId: 'student1', assignmentId: 'exam1_student1',
      attemptNumber: 1, status: 'in_progress', startedAt: now(), questionOrder: ['q1'],
      optionOrder: {}, currentQuestionIndex: 0, flaggedQuestionIds: []
    }));
    await setDoc(doc(db, 'exam_answers/attempt1_q1'), base({
      attemptId: 'attempt1', examId: 'exam1', studentId: 'student1',
      questionId: 'q1', answer: ['A'], markedForReview: false, synced: true
    }));
    await setDoc(doc(db, 'exam_results/attempt1'), base({
      attemptId: 'attempt1', examId: 'exam1', studentId: 'student1',
      finalScore: 100, status: 'published', answers: []
    }));
    await setDoc(doc(db, 'publications/exam1_student1'), base({
      examId: 'exam1', studentId: 'student1', studentIds: ['student1'],
      publishedAt: now(), explanationAvailableAt: now(), revealAtMs: Date.now() + 60_000
    }));
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8085
    }
  });
});

after(async () => {
  await env?.cleanup();
});

describe('Firestore security rules', () => {
  it('guru dapat membaca kunci soal, siswa tidak', async () => {
    await seed();
    const teacher = env.authenticatedContext('teacher1').firestore();
    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(getDoc(doc(teacher, 'questions/q1')));
    await assertFails(getDoc(doc(student, 'questions/q1')));
  });

  it('siswa hanya dapat membaca soal pada ujian yang ditugaskan', async () => {
    await seed();
    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(getDoc(doc(student, 'student_questions/exam1_q1')));
    const other = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(other, 'student_questions/exam1_q1')));
  });

  it('siswa hanya melihat ujian yang ditugaskan', async () => {
    await seed();
    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(getDoc(doc(student, 'exams/exam1')));
    await assertFails(getDoc(doc(student, 'exams/exam2')));
  });

  it('pembahasan terkunci sampai jendela publikasi terbuka', async () => {
    await seed();
    const student = env.authenticatedContext('student1').firestore();
    await assertFails(getDoc(doc(student, 'student_explanations/exam1_q1')));
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'publications/exam1_student1'), { revealAtMs: Date.now() - 1000 });
    });
    await assertSucceeds(getDoc(doc(student, 'student_explanations/exam1_q1')));
  });

  it('siswa tidak dapat menulis hasil atau mengubah kunci', async () => {
    await seed();
    const student = env.authenticatedContext('student1').firestore();
    await assertFails(setDoc(doc(student, 'exam_results/hasil-baru'), { examId: 'exam1', studentId: 'student1', finalScore: 100 }));
    await assertFails(updateDoc(doc(student, 'exam_attempts/attempt1'), { status: 'published' }));
    await assertFails(updateDoc(doc(student, 'questions/q1'), { correctAnswers: ['B'] }));
  });

  it('siswa dapat mengoreksi jawaban saat ujian berjalan, tetapi tidak setelah dikumpulkan', async () => {
    await seed();
    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(updateDoc(doc(student, 'exam_answers/attempt1_q1'), { answer: ['B'] }));
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'exam_attempts/attempt1'), { status: 'submitted' });
    });
    await assertFails(updateDoc(doc(student, 'exam_answers/attempt1_q1'), { answer: ['C'] }));
  });

  it('siswa dapat membuat attempt hanya untuk ujian yang ditugaskan', async () => {
    await seed();
    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(setDoc(doc(student, 'exam_attempts/attempt2'), base({
      examId: 'exam1', studentId: 'student1', assignmentId: 'exam1_student1',
      attemptNumber: 2, status: 'in_progress', startedAt: now(), questionOrder: [],
      optionOrder: {}, currentQuestionIndex: 0, flaggedQuestionIds: []
    })));
    await assertFails(setDoc(doc(student, 'exam_attempts/attempt3'), base({
      examId: 'exam2', studentId: 'student1', attemptNumber: 1, status: 'in_progress', startedAt: now()
    })));
  });

  it('akun tanpa profil tidak mendapat akses', async () => {
    await seed();
    const stranger = env.authenticatedContext('tanpa-profil').firestore();
    await assertFails(getDoc(doc(stranger, 'exams/exam1')));
  });

  it('akun nonaktif tidak mendapat akses meskipun punya claim peran', async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users/student1'), { active: false });
    });
    const inactive = env.authenticatedContext('student1', { role: 'student' }).firestore();
    await assertFails(getDoc(doc(inactive, 'exams/exam1')));
    await assertFails(getDoc(doc(inactive, 'academic_years/th-2026-2027')));
    await assertFails(getDoc(doc(inactive, 'users/student1')));
  });
});
