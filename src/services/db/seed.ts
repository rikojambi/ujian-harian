import { db, isLocalMode } from './index';
import { digest } from '@/services/auth/service';
import { buildStudentQuestionDoc } from '@/services/exams';
import { nanoid } from '@/utils/id';
import type {
  AcademicYear, SchoolClass as Class, Exam, ExamAssignment, ExamQuestionLink, LearningObjective,
  Question, QuestionBank, Student, Subject, Teacher, UserProfile
} from '@/types';

const now = () => new Date().toISOString();
const stamp = (actor = 'system') => ({ createdAt: now(), updatedAt: now(), createdBy: actor, updatedBy: actor });

export interface SeedResult { accounts: Array<{ role: string; email: string; password: string }>; counts: Record<string, number> }

/** Data contoh HANYA untuk mode lokal / development. Dapat dihapus kapan saja lewatPengaturan > Hapus data contoh. */
export async function seedSampleData(): Promise<SeedResult> {
  if (!isLocalMode) throw new Error('Data contoh hanya tersedia pada mode lokal. Gunakan scripts/seed-firestore.mjs untuk Firebase.');
  const marker = await db.get<{ key: string; value: boolean }>('meta', 'sample-data');
  if (marker?.value) throw new Error('Data contoh sudah pernah dimuat.');

  const yearId = nanoid();
  const subjectId = nanoid();
  const classId = nanoid();
  const bankId = nanoid();
  const examId = nanoid();
  const accounts = [
    { role: 'admin', name: 'Administrator', email: 'admin@ujianharian.local', password: 'Admin123!' },
    { role: 'teacher', name: 'Ibu Sari', email: 'guru@ujianharian.local', password: 'Guru123!' },
    { role: 'student', name: 'Andi Pratama', email: 'siswa@ujianharian.local', password: 'Siswa123!' }
  ];

  await db.create('academic_years', {
    id: yearId, name: '2026/2027', semester: 'ganjil', startDate: '2026-07-01', endDate: '2027-06-30', active: true, ...stamp()
  } as AcademicYear as unknown as Record<string, unknown>, yearId);

  await db.create('subjects', {
    id: subjectId, name: 'Matematika', code: 'MTK', description: 'Matematika umum SMK', active: true, ...stamp()
  } as Subject as unknown as Record<string, unknown>, subjectId);

  await db.create('classes', {
    id: classId, name: 'XI RPL 1', level: 'XI', major: 'RPL', academicYearId: yearId, active: true, ...stamp()
  } as unknown as Record<string, unknown>, classId);

  const objectives: LearningObjective[] = [
    { code: 'TP-MAT-01', description: 'Mengidentifikasi unsur-unsur lingkaran', material: 'Lingkaran' },
    { code: 'TP-MAT-02', description: 'Menentukan hubungan sudut pusat dan sudut keliling', material: 'Lingkaran' },
    { code: 'TP-MAT-03', description: 'Menghitung panjang busur lingkaran', material: 'Lingkaran' }
  ].map((item) => ({
    ...item, id: nanoid(), subjectId, classId, academicYearId: yearId, semester: 'ganjil' as const, active: true, ...stamp()
  }));

  for (const objective of objectives) await db.create('learning_objectives', objective as unknown as Record<string, unknown>, objective.id);

  await db.create('question_banks', {
    id: bankId, name: 'Bank Soal Matematika XI', subjectId, classId, academicYearId: yearId,
    semester: 'ganjil', description: 'Contoh bank soal', teacherId: 'seed-teacher', active: true, ...stamp()
  } as QuestionBank as unknown as Record<string, unknown>, bankId);

  const questionSeeds = [
    {
      code: 'MTK-0001', prompt: 'Berikut yang bukan merupakan unsur lingkaran adalah …',
      options: [['A', 'Jari-jari'], ['B', 'Diameter'], ['C', 'Titik pusat'], ['D', 'Sisi'], ['E', 'Busur']],
      answers: ['D'], explanation: 'Unsur lingkaran meliputi titik pusat, jari-jari, diameter, busur, dan tali busur. Sisi bukan unsur lingkaran.',
      tp: objectives[0], difficulty: 'mudah' as const
    },
    {
      code: 'MTK-0002', prompt: 'Sudut pusat yang besarnya 72° menghadap busur dengan sudut keliling sebesar …',
      options: [['A', '18°'], ['B', '36°'], ['C', '72°'], ['D', '144°'], ['E', '180°']],
      answers: ['B'], explanation: 'Besar sudut keliling setengah dari sudut pusat yang menghadap busur yang sama: 72° ÷ 2 = 36°.',
      tp: objectives[1], difficulty: 'sedang' as const
    },
    {
      code: 'MTK-0003', prompt: 'Panjang busur lingkaran berjari-jari 14 cm dengan sudut pusat 90° adalah …',
      options: [['A', '11 cm'], ['B', '14 cm'], ['C', '22 cm'], ['D', '28 cm'], ['E', '44 cm']],
      answers: ['C'], explanation: 'Panjang busur = (θ/360°) × 2πr = (90/360) × 2 × 22/7 × 14 = 22 cm.',
      tp: objectives[2], difficulty: 'sedang' as const
    },
    {
      code: 'MTK-0004', prompt: 'Pilihlah pernyataan yang benar tentang lingkaran!',
      options: [['A', 'Diameter sama dengan dua kali jari-jari'], ['B', 'Tali busur selalu lebih panjang dari diameter'], ['C', 'Sudut keliling sama dengan sudut pusat'], ['D', 'Jari-jari lingkaran berbeda panjang pada satu lingkaran']],
      answers: ['A'], explanation: 'Diameter adalah tali busur yang melalui titik pusat sehingga panjangnya dua kali jari-jari.',
      tp: objectives[0], difficulty: 'mudah' as const, type: 'multiple_response' as const
    },
    {
      code: 'MTK-0005', prompt: 'Nama garis yang menghubungkan dua titik pada lingkaran disebut …',
      options: [], answers: ['tali busur', 'tali'], explanation: 'Tali busur adalah ruas garis yang menghubungkan dua titik di lingkaran.',
      tp: objectives[0], difficulty: 'mudah' as const, type: 'completion' as const
    }
  ];

  const questions: Question[] = questionSeeds.map((item, index) => ({
    id: nanoid(), code: item.code, bankId, subjectId, classId, academicYearId: yearId, semester: 'ganjil',
    material: 'Lingkaran', learningObjectiveIds: [item.tp.id],
    type: item.type ?? 'multiple_choice',
    prompt: item.prompt,
    options: item.options.map(([key, text]) => ({ id: nanoid(), key, text, isCorrect: item.answers.includes(key) })),
    correctAnswers: item.answers,
    acceptedAnswers: item.type === 'completion' ? item.answers : [],
    explanation: item.explanation,
    difficulty: item.difficulty, weight: 20,
    gradingMethod: 'exact_match',
    whitespaceTolerance: 'collapse_all',
    requiresManualReview: false,
    status: 'active', teacherId: 'seed-teacher', tags: ['contoh'],
    order: index, ...stamp()
  } as Question));

  for (const question of questions) await db.create('questions', question as unknown as Record<string, unknown>, question.id);

  for (const account of accounts) {
    const uid = `seed-${account.role}`;
    const salt = nanoid(16);
    const profile: UserProfile = {
      id: uid, uid, name: account.name, email: account.email, role: account.role as UserProfile['role'],
      active: true, ...stamp()
    };
    await db.create('users', profile as unknown as Record<string, unknown>, uid);
    await db.create('credentials', {
      id: uid, uid, email: account.email, displayName: account.name, salt,
      passwordHash: await digest(account.password, salt), role: account.role, createdAt: now()
    } as unknown as Record<string, unknown>, uid);
    if (account.role === 'teacher') {
      const teacher: Teacher = {
        id: uid, uid, name: account.name, email: account.email, subjectIds: [subjectId], classIds: [classId], active: true, ...stamp()
      };
      await db.create('teachers', teacher as unknown as Record<string, unknown>, uid);
    }
    if (account.role === 'student') {
      const student: Student = {
        id: uid, uid, name: account.name, email: account.email, nis: '2026001', classId, active: true, ...stamp()
      };
      await db.create('students', student as unknown as Record<string, unknown>, uid);
    }
  }

  const exam: Exam = {
    id: examId, name: 'Ujian Harian Lingkaran', description: 'Contoh ujian harian matematika', subjectId, classId,
    academicYearId: yearId, semester: 'ganjil',
    startAt: new Date(Date.now() - 60_000).toISOString(),
    endAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    durationMinutes: 30, randomizeQuestions: false, randomizeOptions: false, maxAttempts: 1,
    navigationMode: 'free', autosave: true, showResultImmediately: false, status: 'active',
    teacherId: 'seed-teacher', totalWeight: 100, questionCount: questions.length, passingScore: 70,
    explanationMode: 'on_publish', ...stamp()
  };
  await db.create('exams', exam as unknown as Record<string, unknown>, examId);

  for (const [index, question] of questions.entries()) {
    const link: ExamQuestionLink = {
      id: nanoid(), examId, questionId: question.id, order: index, weight: 20,
      answerKey: question.type === 'completion' ? question.acceptedAnswers : question.correctAnswers,
      type: question.type, learningObjectiveIds: question.learningObjectiveIds, ...stamp()
    };
    await db.create('exam_questions', link as unknown as Record<string, unknown>, link.id);
    const { studentQuestion, explanation } = buildStudentQuestionDoc(examId, question, index, 20, 'seed-teacher');
    await db.create('student_questions', studentQuestion as unknown as Record<string, unknown>, studentQuestion.id);
    await db.create('student_explanations', explanation as unknown as Record<string, unknown>, explanation.id);
  }

  const assignment: ExamAssignment = {
    id: nanoid(), examId, studentId: 'seed-student', classId, assignedBy: 'seed-teacher',
    attemptCount: 0, ...stamp()
  };
  await db.create('exam_assignments', assignment as unknown as Record<string, unknown>, assignment.id);

  await db.create('meta', { key: 'sample-data', value: true } as unknown as Record<string, unknown>, 'sample-data');

  return {
    accounts: accounts.map(({ role, email, password }) => ({ role, email, password })),
    counts: { subjects: 1, classes: 1, objectives: objectives.length, questions: questions.length, exams: 1, students: 1 }
  };
}

export async function clearSampleData(): Promise<void> {
  if (!isLocalMode) throw new Error('Penghapusan data contoh hanya untuk mode lokal.');
  const ids = ['seed-admin', 'seed-teacher', 'seed-student'];
  for (const id of ids) {
    for (const collection of ['users', 'credentials', 'teachers', 'students']) await db.remove(collection, id);
  }

  const removeBy = async (collection: string, field: string, value: string) => {
    const items = await db.list<{ id: string }>(collection, { filters: [{ field, op: '==', value }] });
    for (const item of items) await db.remove(collection, item.id);
  };

  const assignments = await db.list<ExamAssignment>('exam_assignments', { filters: [{ field: 'studentId', op: '==', value: 'seed-student' }] });
  for (const item of assignments) await db.remove('exam_assignments', item.id);

  const exams = await db.list<Exam>('exams', { filters: [{ field: 'teacherId', op: '==', value: 'seed-teacher' }] });
  const questions = await db.list<Question>('questions', { filters: [{ field: 'teacherId', op: '==', value: 'seed-teacher' }] });
  const examIds = new Set([...assignments.map((item) => item.examId), ...exams.map((item) => item.id)]);
  const questionIds = new Set(questions.map((item) => item.id));

  const toRemove = new Map<string, Set<string>>();
  const mark = (collection: string, id: string) => {
    if (!toRemove.has(collection)) toRemove.set(collection, new Set());
    toRemove.get(collection)!.add(id);
  };

  for (const examId of examIds) {
    for (const collection of ['exam_questions', 'student_questions', 'student_explanations', 'exam_attempts', 'exam_answers', 'exam_results', 'publications', 'item_analyses', 'student_analyses']) {
      const items = await db.list<{ id: string }>(collection, { filters: [{ field: 'examId', op: '==', value: examId }] });
      for (const item of items) mark(collection, item.id);
    }
    await db.remove('exams', examId);
  }

  for (const questionId of questionIds) {
    for (const collection of ['exam_questions', 'student_questions', 'student_explanations', 'item_analyses']) {
      const items = await db.list<{ id: string }>(collection, { filters: [{ field: 'questionId', op: '==', value: questionId }] });
      for (const item of items) mark(collection, item.id);
    }
    await db.remove('questions', questionId);
  }

  for (const [collection, docIds] of toRemove) {
    for (const id of docIds) await db.remove(collection, id);
  }

  for (const actor of ids) await removeBy('audit_logs', 'actorId', actor);
  const banks = await db.list<QuestionBank>('question_banks', { filters: [{ field: 'teacherId', op: '==', value: 'seed-teacher' }] });
  for (const bank of banks) await db.remove('question_banks', bank.id);
  const objectives = await db.list<LearningObjective>('learning_objectives');
  for (const objective of objectives.filter((item) => item.code.startsWith('TP-MAT-'))) await db.remove('learning_objectives', objective.id);
  const years = await db.list<AcademicYear>('academic_years');
  for (const year of years.filter((item) => item.name === '2026/2027')) await db.remove('academic_years', year.id);
  const subjects = await db.list<Subject>('subjects');
  for (const subject of subjects.filter((item) => item.code === 'MTK')) await db.remove('subjects', subject.id);
  const classes = await db.list<Class>('classes');
  for (const schoolClass of classes.filter((item) => item.name === 'XI RPL 1')) await db.remove('classes', schoolClass.id);
  await db.remove('meta', 'sample-data');
}
