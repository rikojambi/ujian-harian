import { db } from '@/services/db';
import { analyzeStudentMastery, type AnalysisAnswer, type AnalysisItem } from '@/services/analytics';
import { COLLECTIONS } from '@/services/repository';
import type {
  Exam, ExamAnswer, ExamResult, LearningObjective, StudentAnalysis, StudentQuestionDoc
} from '@/types';

/**
 * Analisis penguasaan siswa. Sengaja hanya membaca dokumen yang boleh diakses siswa:
 * hasil publikasi, salinan soal tanpa kunci, dan jawaban sendiri.
 */
export async function buildStudentAnalysis(studentId: string, options?: {
  subjectId?: string; threshold?: number; minItems?: number; computedAt?: string;
}): Promise<StudentAnalysis[]> {
  const results = (await db.list<ExamResult>(COLLECTIONS.results, { filters: [{ field: 'studentId', op: '==', value: studentId }] }))
    .filter((result) => result.status === 'published' && (!options?.subjectId || result.subjectId === options.subjectId));
  if (!results.length) return [];

  const exams = await Promise.all(results.map((result) => db.get<Exam>(COLLECTIONS.exams, result.examId)));
  const examMap = new Map(exams.filter((exam): exam is Exam => Boolean(exam)).map((exam) => [exam.id, exam]));
  const objectives = await db.list<LearningObjective>(COLLECTIONS.learningObjectives);
  const relevantObjectives = objectives.filter((objective) => !options?.subjectId || objective.subjectId === options.subjectId);
  const allItems = new Map<string, AnalysisItem>();
  const answersByObjective = new Map<string, Record<string, AnalysisAnswer>>();
  const historyByObjective = new Map<string, Array<{ examId: string; date: string; percentage: number }>>();

  for (const result of results) {
    const exam = examMap.get(result.examId);
    if (!exam) continue;
    const studentQuestions = await db.list<StudentQuestionDoc>(COLLECTIONS.studentQuestions, {
      filters: [{ field: 'examId', op: '==', value: exam.id }]
    });
    const answers = await db.list<ExamAnswer>(COLLECTIONS.answers, {
      filters: [{ field: 'attemptId', op: '==', value: result.attemptId }]
    });

    for (const doc of studentQuestions) {
      allItems.set(doc.questionId, {
        questionId: doc.questionId, maxScore: doc.weight, type: doc.type,
        answerKey: [], options: doc.options.map((option) => ({ key: option.key })),
        learningObjectiveIds: doc.learningObjectiveIds
      });
      const evaluation = result.answers.find((item) => item.questionId === doc.questionId);
      if (!evaluation) continue;
      const ownAnswer = answers.find((item) => item.questionId === doc.questionId);
      for (const objectiveId of doc.learningObjectiveIds) {
        const answersMap = answersByObjective.get(objectiveId) ?? {};
        answersMap[doc.questionId] = {
          score: evaluation.earned,
          selected: ownAnswer?.answer ?? []
        };
        answersByObjective.set(objectiveId, answersMap);
        const history = historyByObjective.get(objectiveId) ?? [];
        history.push({
          examId: exam.id,
          date: result.publishedAt ?? result.gradedAt,
          percentage: doc.weight ? Math.round((evaluation.earned / doc.weight) * 100) : 0
        });
        historyByObjective.set(objectiveId, history);
      }
    }
  }

  const items = Array.from(allItems.values());
  return relevantObjectives.flatMap((objective) => {
    const answers = answersByObjective.get(objective.id);
    if (!answers || !Object.keys(answers).length) return [];
    return analyzeStudentMastery({
      studentId,
      objectives: [{ id: objective.id, code: objective.code, description: objective.description }],
      items: items.filter((item) => item.learningObjectiveIds.includes(objective.id)),
      answers,
      threshold: (options?.threshold ?? 75) / 100,
      minItems: options?.minItems ?? 3,
      history: (historyByObjective.get(objective.id) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
      computedAt: options?.computedAt
    });
  }).map((analysis) => {
    const objective = objectives.find((item) => item.id === analysis.learningObjectiveId);
    return { ...analysis, subjectId: objective?.subjectId ?? '', classId: objective?.classId ?? '' };
  });
}
