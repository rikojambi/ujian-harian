import { describe, expect, it } from 'vitest';
import { evaluateItem, normalizeText, scoreAttempt, type ScorableItem } from '@/services/scoring';

const baseItem: ScorableItem = {
  questionId: 'q1',
  type: 'multiple_choice',
  weight: 10,
  answerKey: ['B'],
  acceptedAnswers: [],
  requiresManualReview: false,
  whitespaceTolerance: 'collapse_all'
};

describe('mesin penilaian', () => {
  it('menilai pilihan ganda secara tepat', () => {
    expect(evaluateItem(baseItem, ['B'])).toMatchObject({ correct: true, earned: 10, max: 10 });
    expect(evaluateItem(baseItem, ['A'])).toMatchObject({ correct: false, earned: 0 });
    expect(evaluateItem(baseItem, ['B', 'C'])).toMatchObject({ correct: false, earned: 0 });
  });

  it('mendukung multiple response exact match', () => {
    const item: ScorableItem = { ...baseItem, questionId: 'q2', type: 'multiple_response', answerKey: ['A', 'C'] };
    expect(evaluateItem(item, ['C', 'A'])).toMatchObject({ correct: true, earned: 10 });
    expect(evaluateItem(item, ['A'])).toMatchObject({ correct: false, earned: 0 });
  });

  it('memberikan partial credit sesuai aturan', () => {
    const item: ScorableItem = {
      ...baseItem,
      questionId: 'q3',
      type: 'multiple_response',
      answerKey: ['A', 'B', 'C'],
      gradingMethod: 'partial_credit',
      partialCreditRule: { penaltyPerWrong: 0.5, minScore: 0, allowNegative: false }
    };
    // 2 benar, 1 salah -> (2 - 0.5) / 3 = 0.5
    expect(evaluateItem(item, ['A', 'B', 'D']).earned).toBe(5);
  });

  it('membandingkan jawaban uraian dengan toleransi spasi', () => {
    const item: ScorableItem = {
      ...baseItem, questionId: 'q4', type: 'completion',
      answerKey: ['Sistem Operasi'], acceptedAnswers: ['sistem operasi'], weight: 20
    };
    expect(evaluateItem(item, ['  SISTEM   OPERASI  '])).toMatchObject({ correct: true, earned: 20 });
    const strict = evaluateItem({ ...item, whitespaceTolerance: 'strict' }, ['SISTEM   OPERASI  ']);
    expect(strict.correct).toBe(false);
  });

  it('menandai butir yang perlu pemeriksaan manual', () => {
    const result = evaluateItem({ ...baseItem, requiresManualReview: true }, ['B']);
    expect(result.needsManualReview).toBe(true);
    expect(result.earned).toBe(0);
  });

  it('menghitung skor akhir dan persentase', () => {
    const items: ScorableItem[] = [
      { ...baseItem, questionId: 'q1' },
      { ...baseItem, questionId: 'q2', answerKey: ['A'] }
    ];
    const summary = scoreAttempt(items, [
      { questionId: 'q1', answer: ['B'] },
      { questionId: 'q2', answer: ['B'] }
    ]);
    expect(summary.autoScore).toBe(10);
    expect(summary.maxScore).toBe(20);
    expect(summary.percentage).toBe(50);
    expect(summary.evaluations.map((item) => item.correct)).toEqual([true, false]);
  });

  it('menormalkan teks sesuai mode', () => {
    expect(normalizeText('  Halo   Dunia  ', 'collapse_all')).toBe('halo dunia');
    expect(normalizeText('  Halo   Dunia  ', 'ignore_edges')).toBe('halo   dunia');
    expect(normalizeText('  Halo   Dunia  ', 'strict')).toBe('  halo   dunia  ');
  });
});
