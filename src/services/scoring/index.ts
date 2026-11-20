import type {
  AnswerEvaluation, ExamAnswer, ExamQuestionLink, GradingMethod, QuestionType
} from '@/types';

export interface ScorableItem {
  questionId: string;
  type: QuestionType;
  weight: number;
  answerKey: string[];
  acceptedAnswers?: string[];
  gradingMethod?: GradingMethod;
  partialCreditRule?: { penaltyPerWrong: number; minScore: number; allowNegative: boolean };
  requiresManualReview?: boolean;
  whitespaceTolerance?: 'strict' | 'ignore_edges' | 'collapse_all';
}

export function normalizeText(value: string, tolerance: 'strict' | 'ignore_edges' | 'collapse_all' = 'collapse_all'): string {
  let result = value.toLocaleLowerCase('id-ID');
  if (tolerance === 'strict') return result;
  if (tolerance === 'collapse_all') return result.replace(/\s+/g, ' ').trim();
  return result.trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

export function evaluateItem(item: ScorableItem, rawAnswer: string[] = []): AnswerEvaluation {
  const answer = unique(rawAnswer);
  const max = Math.max(0, item.weight);
  const empty = {
    questionId: item.questionId, earned: 0, max, correct: false, needsManualReview: false
  };

  if (item.requiresManualReview) return { ...empty, needsManualReview: true };

  if (item.type === 'multiple_choice') {
    const correct = answer.length === 1 && item.answerKey.includes(answer[0]);
    return { ...empty, correct, earned: correct ? max : 0 };
  }

  if (item.type === 'multiple_response') {
    const keys = unique(item.answerKey);
    const correctSelected = keys.filter((key) => answer.includes(key)).length;
    const wrongSelected = answer.filter((key) => !keys.includes(key)).length;
    if (correctSelected === 0 && answer.length === 0) return empty;
    const method = item.gradingMethod ?? 'exact_match';
    if (method === 'exact_match') {
      const correct = correctSelected === keys.length && wrongSelected === 0;
      return { ...empty, correct, earned: correct ? max : 0 };
    }
    const rule = item.partialCreditRule ?? { penaltyPerWrong: 0.5, minScore: 0, allowNegative: false };
    const penalty = rule.penaltyPerWrong * wrongSelected;
    const ratio = keys.length ? (correctSelected - penalty) / keys.length : 0;
    let earned = max * Math.max(rule.allowNegative ? -1 : 0, ratio);
    const floor = max * Math.max(0, Math.min(1, rule.minScore));
    earned = rule.allowNegative ? earned : Math.max(floor, earned);
    return {
      ...empty,
      correct: correctSelected === keys.length && wrongSelected === 0,
      earned: Math.round(earned * 100) / 100
    };
  }

  const accepted = unique(item.answerKey.length ? item.answerKey : (item.acceptedAnswers ?? []));
  const tolerance = item.whitespaceTolerance ?? 'collapse_all';
  const normalizedAnswer = normalizeText(answer[0] ?? '', tolerance);
  const correct = normalizedAnswer.length > 0 && accepted.some((key) => normalizeText(key, tolerance) === normalizedAnswer);
  return { ...empty, correct, earned: correct ? max : 0 };
}

export interface ScoreSummary {
  evaluations: AnswerEvaluation[];
  autoScore: number;
  maxScore: number;
  percentage: number;
  needsManualReview: boolean;
}

export function scoreAttempt(
  items: ScorableItem[],
  answers: Array<Pick<ExamAnswer, 'questionId' | 'answer'>>
): ScoreSummary {
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer.answer]));
  const evaluations = items.map((item) => evaluateItem(item, byQuestion.get(item.questionId) ?? []));
  const autoScore = Math.round(evaluations.reduce((total, item) => total + item.earned, 0) * 100) / 100;
  const maxScore = Math.round(evaluations.reduce((total, item) => total + item.max, 0) * 100) / 100;
  return {
    evaluations,
    autoScore,
    maxScore,
    percentage: maxScore ? Math.round((autoScore / maxScore) * 10000) / 100 : 0,
    needsManualReview: evaluations.some((item) => item.needsManualReview)
  };
}

export function itemFromExamLink(link: ExamQuestionLink, question: {
  type: QuestionType; acceptedAnswers: string[]; gradingMethod?: GradingMethod;
  partialCreditRule?: ScorableItem['partialCreditRule']; requiresManualReview: boolean;
  whitespaceTolerance?: ScorableItem['whitespaceTolerance'];
}): ScorableItem {
  return {
    questionId: link.questionId,
    type: link.type,
    weight: link.weight,
    answerKey: link.answerKey,
    acceptedAnswers: question.acceptedAnswers,
    gradingMethod: question.gradingMethod,
    partialCreditRule: question.partialCreditRule,
    requiresManualReview: question.requiresManualReview,
    whitespaceTolerance: question.whitespaceTolerance
  };
}
