import { describe, expect, it } from 'vitest';
import {
  approximatePValue, categorizeDifficulty, categorizeDiscrimination, categorizeValidity,
  cronbachAlpha, difficultyIndex, discriminationUpperLower, kr20, mean, pearson,
  pointBiserial, reliabilityInterpretation, variance
} from '@/services/analytics/statistics';

describe('statistik butir ujian', () => {
  it('menghitung rata-rata dan varians sampel/populasi', () => {
    const values = [1, 2, 3, 4];
    expect(mean(values)).toBe(2.5);
    expect(variance(values)).toBeCloseTo(5 / 3, 6);
    expect(variance(values, false)).toBeCloseTo(1.25, 6);
    expect(mean([])).toBe(0);
    expect(variance([1])).toBe(0);
  });

  it('menghitung korelasi Pearson dan point-biserial', () => {
    expect(pearson([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 6);
    expect(pearson([1, 2, 3], [1, 3, 2])).toBeCloseTo(0.5, 6);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
    expect(pointBiserial([0, 0, 1, 1], [0, 1, 2, 3])).toBeCloseTo(0.894427, 5);
    expect(pointBiserial([0, 0, 0], [0, 1, 2])).toBe(0);
  });

  it('menghitung indeks kesukaran dan kategarinya', () => {
    expect(difficultyIndex([1, 0, 1, 0], 1)).toBe(0.5);
    expect(difficultyIndex([5, 10], 10)).toBeCloseTo(0.75, 6);
    expect(difficultyIndex([], 1)).toBe(0);
    expect(difficultyIndex([1], 0)).toBe(0);
    expect(categorizeDifficulty(0.3)).toBe('sukar');
    expect(categorizeDifficulty(0.31)).toBe('sedang');
    expect(categorizeDifficulty(0.7)).toBe('sedang');
    expect(categorizeDifficulty(0.71)).toBe('mudah');
  });

  it('membedakan kelompok atas dan bawah untuk daya pembeda', () => {
    const result = discriminationUpperLower([1, 1, 0, 0], [3, 2, 1, 0], 1, 0.25);
    expect(result).toMatchObject({ value: 1, upperMean: 1, lowerMean: 0, groupSize: 2 });
    expect(discriminationUpperLower([1, 0], [2, 1], 1).value).toBe(0);
    expect(discriminationUpperLower([1, 0, 1], [3, 2, 1], 1).groupSize).toBe(0);
  });

  it('menghitung KR-20 dan Cronbach alpha tanpa data degenerat', () => {
    const dichotomous = [
      [1, 1, 1, 1],
      [1, 1, 1, 0],
      [1, 1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    expect(kr20(dichotomous)).toBeGreaterThan(0.5);
    expect(kr20([])).toBe(0);
    expect(kr20([[1, 0], [1, 0]])).toBe(0);

    const graded = [
      [1, 0.8, 0.6],
      [0.9, 0.7, 0.5],
      [0.7, 0.5, 0.3],
      [0.4, 0.3, 0.1]
    ];
    expect(cronbachAlpha(graded)).toBeGreaterThan(0.7);
    expect(cronbachAlpha(graded)).toBeCloseTo(cronbachAlpha(graded), 10);
    expect(cronbachAlpha([[1, 1], [1, 1]])).toBe(0);
  });

  it('mengklasifikasikan daya pembeda, validitas, dan interpretasi reliabilitas', () => {
    expect(categorizeDiscrimination(-0.1)).toBe('bermasalah');
    expect(categorizeDiscrimination(0.1)).toBe('kurang');
    expect(categorizeDiscrimination(0.3)).toBe('cukup');
    expect(categorizeDiscrimination(0.5)).toBe('baik');
    expect(categorizeDiscrimination(0.8)).toBe('sangat_baik');

    expect(categorizeValidity(0.45)).toBe('valid');
    expect(categorizeValidity(-0.25)).toBe('ragu');
    expect(categorizeValidity(0.1)).toBe('tidak_valid');

    expect(reliabilityInterpretation(0.92)).toBe('Sangat baik');
    expect(reliabilityInterpretation(0.84)).toBe('Baik');
    expect(reliabilityInterpretation(0.75)).toBe('Cukup');
    expect(reliabilityInterpretation(0.4)).toBe('Buruk');
  });

  it('memberi estimasi signifikansi yang berada dalam rentang 0..1', () => {
    expect(approximatePValue(0, 10)).toBe(1);
    expect(approximatePValue(0.9, 50)).toBeLessThan(0.05);
    expect(approximatePValue(0.1, 5)).toBeGreaterThan(0.05);
    expect(approximatePValue(1, 2)).toBeGreaterThanOrEqual(0);
  });
});
