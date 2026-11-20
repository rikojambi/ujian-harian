import { db } from '@/services/db';
import { analyzeExam, type AnalysisContext } from '@/services/analytics';
import { itemFromExamLink, scoreAttempt, type ScorableItem } from '@/services/scoring';
import { audit, COLLECTIONS, createEntity, updateEntity } from '@/services/repository';
import type {
  Exam, ExamAnswer, ExamAttempt, ExamQuestionLink, ExamResult, Question
} from '@/types';

export async function gradeAttempt(exam: Exam, attemptId: string, actorId: string): Promise<ExamResult> {
  const attempt = await db.get<ExamAttempt>(COLLECTIONS.attempts, attemptId);
  if (!attempt || attempt.examId !== exam.id) throw new Error('Percobaan ujian tidak ditemukan.');
  if (attempt.status !== 'submitted' && attempt.status !== 'awaiting_review') {
    throw new Error('Percobaan belum dikumpulkan.');
  }
  const links = await db.list<ExamQuestionLink>(COLLECTIONS.examQuestions, {
    filters: [{ field: 'examId', op: '==', value: exam.id }]
  });
  links.sort((a, b) => a.order - b.order);
  const questions = await Promise.all(links.map((link) => db.get<Question>(COLLECTIONS.questions, link.questionId)));
  const items: ScorableItem[] = links.flatMap((link, index) => {
    const question = questions[index];
    if (!question) return [];
    return [itemFromExamLink(link, question)];
  });
  const answers = await db.list<ExamAnswer>(COLLECTIONS.answers, {
    filters: [{ field: 'attemptId', op: '==', value: attempt.id }]
  });
  const scoring = scoreAttempt(items, answers);
  const status: ExamResult['status'] = scoring.needsManualReview ? 'awaiting_review' : 'graded';
  const maxScore = scoring.maxScore || exam.totalWeight || 1;
  const percentage = Math.round((scoring.autoScore / maxScore) * 10000) / 100;
  const resultData = {
    attemptId: attempt.id, examId: exam.id, studentId: attempt.studentId,
    classId: exam.classId, subjectId: exam.subjectId,
    answers: scoring.evaluations, autoScore: scoring.autoScore,
    finalScore: percentage, maxScore: 100,
    passed: percentage >= exam.passingScore,
    gradedBy: actorId, gradedAt: new Date().toISOString(),
    status
  } as unknown as Record<string, unknown>;
  const existing = await db.get<ExamResult>(COLLECTIONS.results, attempt.id);
  if (existing) {
    await updateEntity(COLLECTIONS.results, existing.id, resultData, actorId);
  } else {
    await createEntity(COLLECTIONS.results, resultData as Record<string, unknown>, actorId, attempt.id);
  }
  await updateEntity(COLLECTIONS.attempts, attempt.id, { status }, actorId);
  await audit(actorId, 'grade_attempt', 'exam', exam.id, { attemptId: attempt.id, score: percentage });
  return { ...resultData, id: attempt.id } as unknown as ExamResult;
}

export async function recomputeItemAnalysis(exam: Exam, actorId: string): Promise<number> {
  const links = (await db.list<ExamQuestionLink>(COLLECTIONS.examQuestions, {
    filters: [{ field: 'examId', op: '==', value: exam.id }]
  })).sort((a, b) => a.order - b.order);
  const results = await db.list<ExamResult>(COLLECTIONS.results, { filters: [{ field: 'examId', op: '==', value: exam.id }] });
  const graded = results.filter((result) => result.status !== 'awaiting_review');
  const attempts = await Promise.all(graded.map((result) => db.get<ExamAttempt>(COLLECTIONS.attempts, result.attemptId)));
  const answers = await db.list<ExamAnswer>(COLLECTIONS.answers, { filters: [{ field: 'examId', op: '==', value: exam.id }] });
  const context: AnalysisContext = {
    examId: exam.id,
    items: links.map((link) => ({
      questionId: link.questionId,
      maxScore: link.weight,
      type: link.type,
      answerKey: link.answerKey,
      options: [], // Diisi dari dokumen soal di bawah.
      learningObjectiveIds: link.learningObjectiveIds
    })),
    students: graded.flatMap((result, index) => {
      const attempt = attempts[index];
      if (!attempt) return [];
      const studentAnswers = answers.filter((answer) => answer.attemptId === attempt.id);
      const evaluationMap = new Map(result.answers.map((item) => [item.questionId, item]));
      return [{
        studentId: result.studentId,
        totalScore: result.finalScore,
        answers: Object.fromEntries(links.map((link) => {
          const evaluation = evaluationMap.get(link.questionId);
          const studentAnswer = studentAnswers.find((answer) => answer.questionId === link.questionId);
          return [link.questionId, {
            score: (evaluation?.earned ?? 0) / Math.max(1, link.weight) * link.weight,
            selected: studentAnswer?.answer ?? []
          }];
        }))
      }];
    })
  };
  const questions = await Promise.all(links.map((link) => db.get<Question>(COLLECTIONS.questions, link.questionId)));
  context.items.forEach((item, index) => {
    item.options = (questions[index]?.options ?? []).map((option) => ({ key: option.key }));
  });
  const { analyses } = analyzeExam(context);
  for (const analysis of analyses) {
    const existingId = `${exam.id}_${analysis.questionId}`;
    const existing = await db.get<{ id: string; notes?: string[] }>(COLLECTIONS.itemAnalyses, existingId);
    const payload = { ...analysis, id: existingId, notes: existing?.notes ?? analysis.notes };
    if (existing) await updateEntity(COLLECTIONS.itemAnalyses, existingId, payload as unknown as Record<string, unknown>, actorId);
    else await createEntity(COLLECTIONS.itemAnalyses, payload as unknown as Record<string, unknown>, actorId, existingId);
  }
  return analyses.length;
}

export function publicationReadiness(exam: Exam, _links: ExamQuestionLink[], questions: Question[], results: ExamResult[]): string[] {
  const issues: string[] = [];
  if (!results.length) issues.push('Belum ada hasil yang dinilai.');
  if (results.some((result) => result.status === 'awaiting_review')) issues.push('Masih ada jawaban yang menunggu pemeriksaan manual.');
  if (questions.some((question) => !question?.explanation?.trim())) issues.push('Masih ada soal tanpa pembahasan.');
  if (exam.explanationMode === 'scheduled' && !exam.explanationAvailableAt) issues.push('Tanggal pembukaan pembahasan belum ditentukan.');
  return issues;
}

export async function publishResults(exam: Exam, studentIds: string[], actorId: string, force = false): Promise<number> {
  const links = await db.list<ExamQuestionLink>(COLLECTIONS.examQuestions, { filters: [{ field: 'examId', op: '==', value: exam.id }] });
  const questions = await Promise.all(links.map((link) => db.get<Question>(COLLECTIONS.questions, link.questionId)));
  const results = (await db.list<ExamResult>(COLLECTIONS.results, { filters: [{ field: 'examId', op: '==', value: exam.id }] }))
    .filter((result) => studentIds.includes(result.studentId));
  const issues = publicationReadiness(exam, links, questions.filter((q): q is Question => Boolean(q)), results);
  if (issues.length && !force) throw new Error(`Publikasi belum dapat dilakukan: ${issues.join('; ')}.`);
  if (!results.length) throw new Error('Tidak ada hasil untuk dipublikasikan pada siswa yang dipilih.');
  const timestamp = new Date().toISOString();
  const revealAt = exam.explanationMode === 'scheduled' && exam.explanationAvailableAt
    ? exam.explanationAvailableAt : timestamp;
  for (const result of results) {
    await updateEntity(COLLECTIONS.results, result.id, {
      status: 'published', publishedAt: timestamp, publishedBy: actorId
    }, actorId);
    // Gate per siswa dipakai security rules untuk membuka nilai dan pembahasan.
    await createEntity(COLLECTIONS.publications, {
      examId: exam.id, studentId: result.studentId, classId: exam.classId,
      studentIds: [result.studentId], publishedBy: actorId, publishedAt: timestamp,
      explanationAvailableAt: revealAt, revealAtMs: new Date(revealAt).getTime()
    } as unknown as Record<string, unknown>, actorId, `${exam.id}_${result.studentId}`);
  }
  await createEntity(COLLECTIONS.publications, {
    examId: exam.id, classId: exam.classId, studentIds, publishedBy: actorId,
    publishedAt: timestamp, explanationAvailableAt: revealAt
  } as unknown as Record<string, unknown>, actorId, `${exam.id}_${Date.now()}`);
  await audit(actorId, 'publish_results', 'exam', exam.id, { studentIds: studentIds.length, force });
  return results.length;
}

export async function getPublishedResult(studentId: string, examId: string): Promise<ExamResult | null> {
  const results = await db.list<ExamResult>(COLLECTIONS.results, {
    filters: [
      { field: 'examId', op: '==', value: examId },
      { field: 'studentId', op: '==', value: studentId }
    ]
  });
  return results.find((result) => result.status === 'published') ?? null;
}

export async function updateManualScore(result: ExamResult, finalScore: number, note: string, actorId: string): Promise<void> {
  if (finalScore < 0 || finalScore > 100) throw new Error('Nilai harus antara 0 dan 100.');
  const exam = await db.get<Exam>(COLLECTIONS.exams, result.examId);
  await updateEntity(COLLECTIONS.results, result.id, {
    finalScore: Math.round(finalScore * 100) / 100,
    manualOverride: Math.round(finalScore * 100) / 100,
    note,
    passed: finalScore >= (exam?.passingScore ?? 70),
    gradedBy: actorId,
    gradedAt: new Date().toISOString(),
    status: result.status === 'published' ? 'published' : 'graded'
  }, actorId);
  await audit(actorId, 'manual_score', 'exam_result', result.id, { finalScore });
}
