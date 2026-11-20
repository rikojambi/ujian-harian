export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function variance(values: number[], sample = true): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const denominator = sample ? values.length - 1 : values.length;
  return values.reduce((total, value) => total + (value - average) ** 2, 0) / denominator;
}

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const avgX = mean(xs);
  const avgY = mean(ys);
  let numerator = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - avgX;
    const dy = ys[i] - avgY;
    numerator += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }
  const denominator = Math.sqrt(sumX2 * sumY2);
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Korelasi point-biserial secara numerik identik dengan Pearson untuk skor butir 0/1. */
export function pointBiserial(itemScores: number[], totalScores: number[]): number {
  if (variance(itemScores) === 0) return 0;
  return pearson(itemScores, totalScores);
}

export function difficultyIndex(itemScores: number[], maxScore: number): number {
  if (!itemScores.length || maxScore <= 0) return 0;
  return mean(itemScores) / maxScore;
}

export interface DiscriminationResult { value: number; upperMean: number; lowerMean: number; groupSize: number }

export function discriminationUpperLower(
  itemScores: number[], totalScores: number[], maxScore: number, proportion = 0.27
): DiscriminationResult {
  const n = Math.min(itemScores.length, totalScores.length);
  if (n < 4) return { value: 0, upperMean: 0, lowerMean: 0, groupSize: 0 };
  const pairs = Array.from({ length: n }, (_, index) => ({
    item: itemScores[index], total: totalScores[index]
  })).sort((a, b) => b.total - a.total);
  const groupSize = Math.max(2, Math.floor(n * proportion));
  const upper = pairs.slice(0, groupSize);
  const lower = pairs.slice(-groupSize);
  const upperMean = mean(upper.map((pair) => pair.item));
  const lowerMean = mean(lower.map((pair) => pair.item));
  return {
    value: maxScore ? (upperMean - lowerMean) / maxScore : 0,
    upperMean, lowerMean, groupSize
  };
}

/** KR-20 untuk butir dikotomis. Matrix: [siswa][butir] dengan nilai 0 atau 1 (atau proporsi 0..1). */
export function kr20(matrix: number[][]): number {
  const k = matrix[0]?.length ?? 0;
  const n = matrix.length;
  if (k < 2 || n < 2) return 0;
  const totals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const totalVariance = variance(totals);
  if (totalVariance === 0) return 0;
  let itemVariance = 0;
  for (let item = 0; item < k; item += 1) {
    const p = mean(matrix.map((row) => row[item]));
    itemVariance += p * (1 - p);
  }
  return (k / (k - 1)) * (1 - itemVariance / totalVariance);
}

/** Cronbach's Alpha untuk skor butir bertahap/parsial. */
export function cronbachAlpha(matrix: number[][]): number {
  const k = matrix[0]?.length ?? 0;
  if (k < 2 || matrix.length < 2) return 0;
  const totals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const totalVariance = variance(totals);
  if (totalVariance === 0) return 0;
  let itemVariance = 0;
  for (let item = 0; item < k; item += 1) itemVariance += variance(matrix.map((row) => row[item]));
  return (k / (k - 1)) * (1 - itemVariance / totalVariance);
}

export function categorizeDifficulty(index: number): 'sukar' | 'sedang' | 'mudah' {
  if (index <= 0.3) return 'sukar';
  if (index <= 0.7) return 'sedang';
  return 'mudah';
}

export function categorizeDiscrimination(value: number): 'sangat_baik' | 'baik' | 'cukup' | 'kurang' | 'bermasalah' {
  if (value < 0) return 'bermasalah';
  if (value >= 0.7) return 'sangat_baik';
  if (value >= 0.4) return 'baik';
  if (value >= 0.2) return 'cukup';
  return 'kurang';
}

export function categorizeValidity(r: number): 'valid' | 'ragu' | 'tidak_valid' {
  const absolute = Math.abs(r);
  if (absolute >= 0.4) return 'valid';
  if (absolute >= 0.2) return 'ragu';
  return 'tidak_valid';
}

export function reliabilityInterpretation(value: number): string {
  if (value >= 0.9) return 'Sangat baik';
  if (value >= 0.8) return 'Baik';
  if (value >= 0.7) return 'Cukup';
  if (value >= 0.6) return 'Ragu';
  return 'Buruk';
}

/** Estimasi signifikansi korelasi tanpa distribusi t lengkap (pendekatan normal untuk n besar). */
export function approximatePValue(r: number, n: number): number {
  if (n < 3 || r === 0) return 1;
  const t = Math.abs(r) * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
  // Pendekatan tail normal untuk t; cukup untuk indikasi, bukan uji eksak.
  const z = t;
  return Math.max(0, Math.min(1, 2 * (1 - normalCdf(z))));
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const probability = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - probability : probability;
}
