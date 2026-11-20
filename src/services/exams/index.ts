import { db, type WriteOperation } from '@/services/db';
import { audit, COLLECTIONS, createEntity, createPayload, updateEntity } from '@/services/repository';
import { nanoid } from '@/utils/id';
import type {
  Exam, ExamAnswer, ExamAssignment, ExamAttempt, ExamQuestionLink, MediaAsset, Question,
  StudentExplanationDoc, StudentQuestionDoc
} from '@/types';

export interface StudentQuestion {
  id: string;
  order: number;
  prompt: string;
  stimulus?: string;
  type: Question['type'];
  weight: number;
  media?: Question['media'];
  options: Array<{ id: string; key: string; text: string; image?: MediaAsset }>;
  learningObjectiveIds: string[];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function examWindow(exam: Exam, now = Date.now()): 'before' | 'open' | 'closed' {
  if (now < new Date(exam.startAt).getTime()) return 'before';
  if (now > new Date(exam.endAt).getTime()) return 'closed';
  return 'open';
}

export async function getExamLinks(examId: string): Promise<ExamQuestionLink[]> {
  const links = await db.list<ExamQuestionLink>(COLLECTIONS.examQuestions, { filters: [{ field: 'examId', op: '==', value: examId }] });
  return links.sort((a, b) => a.order - b.order);
}

export async function getAssignedExams(studentId: string): Promise<Array<{ exam: Exam; assignment: ExamAssignment; attempt: ExamAttempt | null }>> {
  const assignments = await db.list<ExamAssignment>(COLLECTIONS.assignments, {
    filters: [{ field: 'studentId', op: '==', value: studentId }]
  });
  const attempts = await db.list<ExamAttempt>(COLLECTIONS.attempts, {
    filters: [{ field: 'studentId', op: '==', value: studentId }]
  });
  const exams = await Promise.all(assignments.map((assignment) => db.get<Exam>(COLLECTIONS.exams, assignment.examId)));
  return assignments.flatMap((assignment, index) => {
    const exam = exams[index];
    if (!exam) return [];
    return [{
      exam,
      assignment,
      attempt: attempts
        .filter((item) => item.examId === exam.id)
        .sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null
    }];
  }).sort((a, b) => a.exam.startAt.localeCompare(b.exam.startAt));
}

export function buildStudentQuestionDoc(
  examId: string, question: Question, order: number, weight: number, actorId: string
): { studentQuestion: StudentQuestionDoc; explanation: StudentExplanationDoc } {
  const stamp = createPayload({} as Record<string, unknown>, actorId);
  return {
    studentQuestion: {
      ...stamp, id: `${examId}_${question.id}`, examId, questionId: question.id, order,
      prompt: question.prompt, stimulus: question.stimulus, type: question.type, weight,
      media: question.media, learningObjectiveIds: question.learningObjectiveIds,
      options: question.options.map((option) => ({ id: option.id, key: option.key, text: option.text, image: option.image }))
    } as StudentQuestionDoc,
    explanation: {
      ...stamp, id: `${examId}_${question.id}`, examId, questionId: question.id,
      correctAnswers: question.acceptedAnswers.length && question.type === 'completion' ? question.acceptedAnswers : question.correctAnswers,
      explanation: question.explanation, explanationMedia: question.explanationMedia,
      explanationAvailableAt: question.explanationAvailableAt
    } as StudentExplanationDoc
  };
}

export async function prepareStudentQuestions(exam: Exam, attempt: ExamAttempt, links: ExamQuestionLink[]): Promise<StudentQuestion[]> {
  // Hanya membaca salinan tanpa kunci jawaban dan pembahasan.
  const docs = await db.list<StudentQuestionDoc>(COLLECTIONS.studentQuestions, {
    filters: [{ field: 'examId', op: '==', value: exam.id }]
  });
  const byId = new Map(docs.map((doc) => [doc.questionId, doc]));
  const order = attempt.questionOrder.length ? attempt.questionOrder : links.map((link) => link.questionId);
  return order.flatMap((questionId, index) => {
    const doc = byId.get(questionId);
    if (!doc) return [];
    const preferred = attempt.optionOrder[questionId] ?? doc.options.map((option) => option.key);
    const sortedOptions = [...doc.options].sort((a, b) => preferred.indexOf(a.key) - preferred.indexOf(b.key));
    return [{
      id: doc.questionId, order: index, prompt: doc.prompt, stimulus: doc.stimulus,
      type: doc.type, weight: doc.weight, media: doc.media,
      options: sortedOptions, learningObjectiveIds: doc.learningObjectiveIds
    }];
  });
}

export async function createExamQuestionLink(
  examId: string, question: Question, weight: number, order: number, actorId: string
): Promise<void> {
  const stamp = createPayload({} as Record<string, unknown>, actorId);
  const link: ExamQuestionLink = {
    ...stamp, id: `${examId}_${question.id}`, examId, questionId: question.id, order, weight,
    answerKey: question.type === 'completion' ? question.acceptedAnswers : question.correctAnswers,
    type: question.type, learningObjectiveIds: question.learningObjectiveIds
  } as ExamQuestionLink;
  const { studentQuestion, explanation } = buildStudentQuestionDoc(examId, question, order, weight, actorId);
  await db.batch([
    { type: 'create', collection: COLLECTIONS.examQuestions, id: link.id, data: link as unknown as Record<string, unknown> },
    { type: 'create', collection: COLLECTIONS.studentQuestions, id: studentQuestion.id, data: studentQuestion as unknown as Record<string, unknown> },
    { type: 'create', collection: COLLECTIONS.studentExplanations, id: explanation.id, data: explanation as unknown as Record<string, unknown> }
  ]);
}

export async function startAttempt(
  exam: Exam, assignment: ExamAssignment, studentId: string, actorId: string
): Promise<ExamAttempt> {
  if (exam.status !== 'active') throw new Error('Ujian belum aktif.');
  if (examWindow(exam) !== 'open') throw new Error('Ujian hanya dapat dikerjakan pada jadwal yang ditentukan.');
  const myAttempts = await db.list<ExamAttempt>(COLLECTIONS.attempts, {
    filters: [
      { field: 'examId', op: '==', value: exam.id },
      { field: 'studentId', op: '==', value: studentId }
    ]
  });
  if (myAttempts.length >= exam.maxAttempts) throw new Error('Batas percobaan sudah terlampaui.');
  const ongoing = myAttempts.find((item) => item.status === 'in_progress');
  if (ongoing) return ongoing;

  const links = await getExamLinks(exam.id);
  const questionIds = links.map((link) => link.questionId);
  const questionOrder = exam.randomizeQuestions ? shuffle(questionIds) : questionIds;
  // Gunakan salinan siswa (tanpa kunci jawaban), bukan dokumen soal guru.
  const studentDocs = await Promise.all(links.map((link) => db.get<StudentQuestionDoc>(COLLECTIONS.studentQuestions, `${exam.id}_${link.questionId}`)));
  const optionOrder: Record<string, string[]> = {};
  if (exam.randomizeOptions) {
    for (const doc of studentDocs) {
      if (doc) optionOrder[doc.questionId] = shuffle(doc.options.map((option) => option.key));
    }
  }
  const attempt: ExamAttempt = {
    id: nanoid(), examId: exam.id, studentId, assignmentId: assignment.id,
    attemptNumber: myAttempts.length + 1, status: 'in_progress',
    startedAt: new Date().toISOString(), timeSpentSeconds: 0,
    questionOrder, optionOrder, currentQuestionIndex: 0, flaggedQuestionIds: [],
    ...createPayload({} as Record<string, unknown>, actorId)
  } as unknown as ExamAttempt;
  await db.create(COLLECTIONS.attempts, attempt as unknown as Record<string, unknown>, attempt.id);
  await audit(actorId, 'start_attempt', 'exam', exam.id, { attemptId: attempt.id });
  return attempt;
}

export async function saveAnswer(
  attempt: ExamAttempt, questionId: string, answer: string[], actorId: string, markedForReview = false
): Promise<void> {
  if (attempt.status !== 'in_progress') throw new Error('Ujian sudah tidak dapat diubah.');
  const existing = await db.list<ExamAnswer>(COLLECTIONS.answers, {
    filters: [
      { field: 'attemptId', op: '==', value: attempt.id },
      { field: 'questionId', op: '==', value: questionId }
    ],
    limit: 1
  });
  const timestamp = new Date().toISOString();
  const payload = {
    attemptId: attempt.id, examId: attempt.examId, studentId: attempt.studentId,
    questionId, answer, markedForReview, answeredAt: existing[0]?.answeredAt ?? timestamp,
    updatedAtClient: timestamp, synced: false
  };
  if (existing[0]) await updateEntity(COLLECTIONS.answers, existing[0].id, payload, actorId);
  else await createEntity(COLLECTIONS.answers, payload, actorId, `${attempt.id}_${questionId}`);
}

export async function submitAttempt(attempt: ExamAttempt, actorId: string, submissionId?: string): Promise<void> {
  if (attempt.status !== 'in_progress') return;
  await updateEntity(COLLECTIONS.attempts, attempt.id, {
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString()
  }, actorId);
  await audit(actorId, 'submit_attempt', 'attempt', attempt.id, { submissionId });
}

export async function createExamWithQuestions(
  examData: Omit<Exam, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  selected: Array<{ questionId: string; weight: number }>,
  studentIds: string[],
  actorId: string
): Promise<string> {
  const examId = nanoid();
  const questionCount = selected.length;
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
  await createEntity(COLLECTIONS.exams, {
    ...examData, id: examId, questionCount, totalWeight
  } as unknown as Record<string, unknown>, actorId, examId);
  const linkOperations: WriteOperation[] = [];
  for (const [order, item] of selected.entries()) {
    const question = await db.get<Question>(COLLECTIONS.questions, item.questionId);
    if (!question) continue;
    const stamp = createPayload({} as Record<string, unknown>, actorId);
    const link: ExamQuestionLink = {
      ...stamp, id: `${examId}_${item.questionId}`, examId, questionId: item.questionId, order, weight: item.weight,
      answerKey: question.type === 'completion' ? question.acceptedAnswers : question.correctAnswers,
      type: question.type, learningObjectiveIds: question.learningObjectiveIds
    } as ExamQuestionLink;
    const { studentQuestion, explanation } = buildStudentQuestionDoc(examId, question, order, item.weight, actorId);
    linkOperations.push(
      { type: 'create', collection: COLLECTIONS.examQuestions, id: link.id, data: link as unknown as Record<string, unknown> },
      { type: 'create', collection: COLLECTIONS.studentQuestions, id: studentQuestion.id, data: studentQuestion as unknown as Record<string, unknown> },
      { type: 'create', collection: COLLECTIONS.studentExplanations, id: explanation.id, data: explanation as unknown as Record<string, unknown> }
    );
  }
  const assignments = studentIds.map((studentId) => ({
    id: `${examId}_${studentId}`, examId, studentId, classId: examData.classId,
    assignedBy: actorId, attemptCount: 0,
    ...createPayload({} as Record<string, unknown>, actorId)
  } as unknown as ExamAssignment));
  await db.batch([
    ...linkOperations,
    ...assignments.map((assignment) => ({ type: 'create' as const, collection: COLLECTIONS.assignments, id: assignment.id, data: assignment as unknown as Record<string, unknown> }))
  ]);
  await audit(actorId, 'create_exam', 'exam', examId, { questionCount, studentIds: studentIds.length });
  return examId;
}

export async function updateExamAssignments(examId: string, studentIds: string[], classId: string, actorId: string): Promise<void> {
  const existing = await db.list<ExamAssignment>(COLLECTIONS.assignments, { filters: [{ field: 'examId', op: '==', value: examId }] });
  const existingIds = new Set(existing.map((item) => item.studentId));
  const operations = [
    ...existing.filter((item) => !studentIds.includes(item.studentId))
      .map((item) => ({ type: 'delete' as const, collection: COLLECTIONS.assignments, id: item.id })),
    ...studentIds.filter((id) => !existingIds.has(id)).map((studentId) => {
      const assignment = {
        id: `${examId}_${studentId}`, examId, studentId, classId, assignedBy: actorId, attemptCount: 0,
        ...createPayload({} as Record<string, unknown>, actorId)
      } as unknown as ExamAssignment;
      return { type: 'create' as const, collection: COLLECTIONS.assignments, id: assignment.id, data: assignment as unknown as Record<string, unknown> };
    })
  ];
  if (operations.length) await db.batch(operations);
  await audit(actorId, 'update_assignments', 'exam', examId, { studentIds: studentIds.length });
}
