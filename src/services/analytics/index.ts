import type { ItemAnalysis, QuestionType, StudentAnalysis } from '@/types';
import {
  approximatePValue, categorizeDifficulty, categorizeDiscrimination, categorizeValidity,
  cronbachAlpha, difficultyIndex, discriminationUpperLower, kr20, mean, pointBiserial, reliabilityInterpretation
} from './statistics';

export interface AnalysisItem {
  questionId: string;
  maxScore: number;
  type: QuestionType;
  answerKey: string[];
  options: Array<{ key: string }>;
  learningObjectiveIds: string[];
}

export interface AnalysisAnswer {
  score: number;
  selected?: string[];
}

export interface AnalysisStudent {
  studentId: string;
  totalScore: number;
  answers: Record<string, AnalysisAnswer>;
}

export interface AnalysisContext {
  examId: string;
  items: AnalysisItem[];
  students: AnalysisStudent[];
  computedAt?: string;
}

export interface ExamReliability {
  method: 'KR-20' | 'Cronbach Alpha';
  value: number;
  itemCount: number;
  sampleSize: number;
  interpretation: string;
  warning?: string;
}

export function computeReliability(context: AnalysisContext): ExamReliability {
  const { items, students } = context;
  const matrix = students.map((student) => items.map((item) => {
    const answer = student.answers[item.questionId];
    return item.maxScore ? (answer?.score ?? 0) / item.maxScore : 0;
  }));
  const dichotomous = items.every((item) => students.every((student) => {
    const score = student.answers[item.questionId]?.score ?? 0;
    return score === 0 || Math.abs(score - item.maxScore) < 1e-9;
  }));
  const method = dichotomous ? 'KR-20' : 'Cronbach Alpha';
  const value = dichotomous ? kr20(matrix) : cronbachAlpha(matrix);
  return {
    method,
    value: Math.round(value * 1000) / 1000,
    itemCount: items.length,
    sampleSize: students.length,
    interpretation: reliabilityInterpretation(value),
    warning: students.length < 20
      ? 'Jumlah peserta < 20: koefisien reliabilitas belum stabil.'
      : items.length < 10 ? 'Jumlah butir < 10: interpretasi reliabilitas perlu kehati-hatian.' : undefined
  };
}

const DISCRIMINATION_LABEL: Record<string, string> = {
  sangat_baik: 'Sangat baik', baik: 'Baik', cukup: 'Cukup', kurang: 'Kurang', bermasalah: 'Bermasalah'
};

export function analyzeExam(context: AnalysisContext): { analyses: ItemAnalysis[]; reliability: ExamReliability; notes: string[] } {
  const { items, students } = context;
  const computedAt = context.computedAt ?? new Date().toISOString();
  const reliability = computeReliability(context);
  const groupSize = Math.max(2, Math.floor(students.length * 0.27));
  const upperIds = new Set(students.slice().sort((a, b) => b.totalScore - a.totalScore).slice(0, groupSize).map((s) => s.studentId));
  const lowerIds = new Set(students.slice().sort((a, b) => a.totalScore - b.totalScore).slice(0, groupSize).map((s) => s.studentId));

  const analyses = items.map((item): ItemAnalysis => {
    const scores = students.map((student) => student.answers[item.questionId]?.score ?? 0);
    const totals = students.map((student) => student.totalScore);
    const difficulty = difficultyIndex(scores, item.maxScore);
    const discrimination = discriminationUpperLower(scores, totals, item.maxScore);
    const correlation = pointBiserial(scores, totals);
    const pValue = approximatePValue(correlation, students.length);
    const difficultyCategory = categorizeDifficulty(difficulty);
    const discriminationCategory = categorizeDiscrimination(discrimination.value);
    const validityStatus = categorizeValidity(correlation);
    const notes: string[] = [];

    if (students.length < 10) notes.push('Sampel < 10: statistik butir belum dapat diandalkan.');
    if (difficulty < 0.15) notes.push('Hampir tidak ada siswa yang menjawab benar; periksa kejelasan soal atau kunci.');
    if (difficulty > 0.95) notes.push('Hampir semua siswa menjawab benar; butir kurang menantang.');
    if (discrimination.value < 0) notes.push('Daya pembeda negatif: siswa berkemampuan tinggi cenderung salah.');
    if (validityStatus === 'tidak_valid') notes.push('Korelasi butir–total rendah; bukan bukti invaliditas isi, tetapi perlu ditelaah.');
    if (pValue > 0.05) notes.push('Korelasi tidak signifikan secara statistik (p > 0,05).');

    const distractors = item.type === 'multiple_choice' || item.type === 'multiple_response'
      ? item.options.map((option) => {
          const selectors = students.filter((student) => (student.answers[item.questionId]?.selected ?? []).includes(option.key));
          return {
            key: option.key,
            count: selectors.length,
            percentage: students.length ? Math.round((selectors.length / students.length) * 1000) / 10 : 0,
            chosenByUpper: selectors.filter((student) => upperIds.has(student.studentId)).length,
            chosenByLower: selectors.filter((student) => lowerIds.has(student.studentId)).length
          };
        })
      : [];

    const unused = distractors.filter((option) => !item.answerKey.includes(option.key) && option.count === 0);
    if (unused.length) notes.push(`Pengecoh tidak dipilih: ${unused.map((option) => option.key).join(', ')}.`);
    const highGroupDistractor = distractors.find((option) => !item.answerKey.includes(option.key)
      && option.chosenByUpper > 0 && option.chosenByUpper >= option.chosenByLower && option.count > 0);
    if (highGroupDistractor) notes.push(`Pengecoh ${highGroupDistractor.key} juga diminati kelompok atas; periksa ambiguitas.`);

    let recommendation: ItemAnalysis['recommendation'] = 'dipertahankan';
    if (discrimination.value < 0 || difficulty < 0.1 || difficulty > 0.97) recommendation = 'dibuang';
    else if (discrimination.value < 0.2 || validityStatus === 'tidak_valid' || unused.length > 1) recommendation = 'direvisi';

    return {
      id: '', examId: context.examId, questionId: item.questionId,
      sampleSize: students.length,
      difficultyIndex: Math.round(difficulty * 1000) / 1000,
      difficultyCategory,
      discriminationIndex: Math.round(discrimination.value * 1000) / 1000,
      discriminationCategory,
      pointBiserial: Math.round(correlation * 1000) / 1000,
      validityStatus,
      reliability: { ...reliability },
      distractors,
      recommendation,
      notes,
      computedAt
    } as ItemAnalysis;
  });

  return {
    analyses,
    reliability,
    notes: [
      'Kategori daya pembeda menggunakan kelompok atas–bawah 27% (Kelley).',
      'Korelasi butir–total adalah indikator konsistensi internal, bukan bukti validitas isi.',
      `Reliabilitas: ${reliability.method} = ${reliability.value} (${reliability.interpretation}).`,
      ...(reliability.warning ? [reliability.warning] : [])
    ]
  };
}

export interface MasteryInput {
  studentId: string;
  objectives: Array<{ id: string; code: string; description: string }>;
  items: AnalysisItem[];
  answers: Record<string, AnalysisAnswer>;
  threshold: number;
  minItems: number;
  history?: Array<{ examId: string; date: string; percentage: number }>;
  computedAt?: string;
}

export function analyzeStudentMastery(input: MasteryInput): StudentAnalysis[] {
  const computedAt = input.computedAt ?? new Date().toISOString();
  return input.objectives.map((objective) => {
    const objectiveItems = input.items.filter((item) => item.learningObjectiveIds.includes(objective.id));
    const totalItems = objectiveItems.length;
    const correctItems = objectiveItems.filter((item) => {
      const answer = input.answers[item.questionId];
      return answer ? answer.score >= item.maxScore * 0.8 : false;
    }).length;
    const percentage = totalItems ? Math.round((correctItems / totalItems) * 1000) / 10 : 0;
    const evidenceSufficient = totalItems >= input.minItems;
    const status: StudentAnalysis['status'] = !evidenceSufficient
      ? (percentage >= input.threshold * 100 ? 'dikuasai' : 'perlu_remedial')
      : percentage >= input.threshold * 100 ? 'dikuasai'
        : percentage >= input.threshold * 60 ? 'perlu_penguatan' : 'perlu_remedial';
    return {
      id: '', studentId: input.studentId, subjectId: '', classId: '',
      learningObjectiveId: objective.id, totalItems, correctItems, percentage,
      status, evidenceSufficient,
      trend: input.history ?? [], computedAt
    } as StudentAnalysis;
  });
}

export function average(values: number[]): number {
  return Math.round(mean(values) * 100) / 100;
}

export { pointBiserial, kr20, cronbachAlpha, difficultyIndex, categorizeDifficulty, categorizeDiscrimination, DISCRIMINATION_LABEL };
