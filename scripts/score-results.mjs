import { initAdmin, stamp, updated } from './lib/admin.mjs';

const argv = process.argv.slice(2);
function option(name, fallback = '') {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? (argv[index + 1] ?? '') : fallback;
}
const hasFlag = (name) => argv.includes(`--${name}`);
const examFilter = option('exam');
const actorId = option('actor', 'admin-script');
const shouldPublish = hasFlag('publish');
const force = hasFlag('force');

function unique(values = []) {
  return Array.from(new Set(values.map(String).map((value) => value.trim()).filter(Boolean)));
}

function normalize(value, tolerance = 'collapse_all') {
  let text = String(value ?? '').toLocaleLowerCase('id-ID');
  if (tolerance === 'strict') return text;
  if (tolerance === 'collapse_all') text = text.replace(/\s+/g, ' ').trim();
  return text.trim();
}

function evaluateItem(item, rawAnswer = []) {
  const answer = unique(rawAnswer);
  const max = Math.max(0, Number(item.weight) || 0);
  const empty = { questionId: item.questionId, earned: 0, max, correct: false, needsManualReview: false };
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
    if ((item.gradingMethod ?? 'exact_match') === 'exact_match') {
      const correct = correctSelected === keys.length && wrongSelected === 0;
      return { ...empty, correct, earned: correct ? max : 0 };
    }
    const rule = item.partialCreditRule ?? { penaltyPerWrong: 0.5, minScore: 0, allowNegative: false };
    const ratio = keys.length ? (correctSelected - rule.penaltyPerWrong * wrongSelected) / keys.length : 0;
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
  const normalizedAnswer = normalize(answer[0] ?? '', tolerance);
  const correct = normalizedAnswer.length > 0
    && accepted.some((key) => normalize(key, tolerance) === normalizedAnswer);
  return { ...empty, correct, earned: correct ? max : 0 };
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
function variance(values, sample = true) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (sample ? values.length - 1 : values.length);
}
function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const xs = x.slice(0, n); const ys = y.slice(0, n);
  const mx = mean(xs); const my = mean(ys);
  let num = 0; let sx = 0; let sy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx; const dy = ys[i] - my;
    num += dx * dy; sx += dx * dx; sy += dy * dy;
  }
  const denominator = Math.sqrt(sx * sy);
  return denominator ? num / denominator : 0;
}
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

function reliability(matrix) {
  const k = matrix[0]?.length ?? 0;
  if (k < 2 || matrix.length < 2) return { method: 'KR-20', value: 0, itemCount: k, sampleSize: matrix.length, interpretation: 'Buruk' };
  const totals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const totalVariance = variance(totals);
  const dichotomous = matrix.every((row) => row.every((value) => value === 0 || Math.abs(value - 1) < 1e-9));
  let itemVariance = 0;
  for (let item = 0; item < k; item += 1) {
    const column = matrix.map((row) => row[item]);
    itemVariance += dichotomous ? mean(column) * (1 - mean(column)) : variance(column);
  }
  const raw = totalVariance ? (k / (k - 1)) * (1 - itemVariance / totalVariance) : 0;
  const value = round(raw);
  const interpretation = value >= 0.9 ? 'Sangat baik' : value >= 0.8 ? 'Baik' : value >= 0.7 ? 'Cukup' : value >= 0.6 ? 'Ragu' : 'Buruk';
  return {
    method: dichotomous ? 'KR-20' : 'Cronbach Alpha', value,
    itemCount: k, sampleSize: matrix.length, interpretation,
    ...(matrix.length < 20 ? { warning: 'Jumlah peserta < 20: koefisien reliabilitas belum stabil.' } : {})
  };
}

function analyzeItems({ links, questions, results, answers }) {
  const students = results.filter((result) => result.status !== 'awaiting_review').map((result) => {
    const ownAnswers = answers.filter((answer) => answer.attemptId === result.attemptId);
    const evaluationMap = new Map(result.answers.map((evaluation) => [evaluation.questionId, evaluation]));
    return {
      studentId: result.studentId,
      totalScore: result.finalScore,
      answers: Object.fromEntries(links.map((link) => [link.questionId, {
        score: (evaluationMap.get(link.questionId)?.earned ?? 0) / Math.max(1e-9, link.weight),
        selected: ownAnswers.find((answer) => answer.questionId === link.questionId)?.answer ?? []
      }]))
    };
  });
  const matrix = students.map((student) => links.map((link) => student.answers[link.questionId]?.score ?? 0));
  const examReliability = reliability(matrix);
  const groupSize = Math.max(2, Math.floor(students.length * 0.27));
  const upperIds = new Set(students.slice().sort((a, b) => b.totalScore - a.totalScore).slice(0, groupSize).map((s) => s.studentId));
  const lowerIds = new Set(students.slice().sort((a, b) => a.totalScore - b.totalScore).slice(0, groupSize).map((s) => s.studentId));

  return links.map((link) => {
    const scores = students.map((student) => (student.answers[link.questionId]?.score ?? 0) * link.weight);
    const difficulty = link.weight ? mean(scores) / link.weight : 0;
    const totals = students.map((student) => student.totalScore);
    const pairs = students.map((student, index) => ({ student, score: scores[index] }))
      .sort((a, b) => b.student.totalScore - a.student.totalScore);
    const upper = pairs.slice(0, groupSize);
    const lower = pairs.slice(-groupSize);
    const discrimination = link.weight
      ? (mean(upper.map((pair) => pair.score)) - mean(lower.map((pair) => pair.score))) / link.weight : 0;
    const correlation = pearson(scores, totals);
    const question = questions.find((item) => item.id === link.questionId);
    const distractors = question && ['multiple_choice', 'multiple_response'].includes(question.type)
      ? question.options.map((option) => {
        const selectors = students.filter((student) => (student.answers[link.questionId]?.selected ?? []).includes(option.key));
        return {
          key: option.key, count: selectors.length,
          percentage: students.length ? round(selectors.length / students.length * 100, 1) : 0,
          chosenByUpper: selectors.filter((student) => upperIds.has(student.studentId)).length,
          chosenByLower: selectors.filter((student) => lowerIds.has(student.studentId)).length
        };
      }) : [];
    const notes = [];
    if (students.length < 10) notes.push('Sampel < 10: statistik butir belum dapat diandalkan.');
    const unused = distractors.filter((option) => !link.answerKey.includes(option.key) && option.count === 0);
    if (unused.length) notes.push(`Pengecoh tidak dipilih: ${unused.map((option) => option.key).join(', ')}.`);
    const recommendation = discrimination < 0 || difficulty < 0.1 || difficulty > 0.97
      ? 'dibuang' : (discrimination < 0.2 || Math.abs(correlation) < 0.2 || unused.length > 1 ? 'direvisi' : 'dipertahankan');
    return {
      examId: link.examId, questionId: link.questionId, sampleSize: students.length,
      difficultyIndex: round(difficulty),
      difficultyCategory: difficulty <= 0.3 ? 'sukar' : difficulty <= 0.7 ? 'sedang' : 'mudah',
      discriminationIndex: round(discrimination),
      discriminationCategory: discrimination < 0 ? 'bermasalah' : discrimination >= 0.7 ? 'sangat_baik'
        : discrimination >= 0.4 ? 'baik' : discrimination >= 0.2 ? 'cukup' : 'kurang',
      pointBiserial: round(correlation),
      validityStatus: Math.abs(correlation) >= 0.4 ? 'valid' : Math.abs(correlation) >= 0.2 ? 'ragu' : 'tidak_valid',
      reliability: examReliability,
      distractors, recommendation, notes, computedAt: new Date().toISOString()
    };
  });
}

async function publish(db, exam, results, force) {
  const issues = [];
  if (!results.length) issues.push('Belum ada hasil yang dinilai.');
  if (results.some((result) => result.status === 'awaiting_review')) issues.push('Masih ada jawaban menunggu pemeriksaan manual.');
  const linksSnapshot = await db.collection('exam_questions').where('examId', '==', exam.id).get();
  const questionDocs = await Promise.all(linksSnapshot.docs.map((link) => db.collection('questions').doc(link.data().questionId).get()));
  if (questionDocs.some((doc) => !doc.exists || !doc.data().explanation?.trim())) issues.push('Masih ada soal tanpa pembahasan.');
  if (exam.explanationMode === 'scheduled' && !exam.explanationAvailableAt) issues.push('Tanggal pembukaan pembahasan belum ditentukan.');
  if (issues.length && !force) throw new Error(`Publikasi gagal: ${issues.join('; ')}`);

  const timestamp = new Date().toISOString();
  const revealAt = exam.explanationMode === 'scheduled' && exam.explanationAvailableAt ? exam.explanationAvailableAt : timestamp;
  const batch = db.batch();
  for (const result of results) {
    batch.update(db.collection('exam_results').doc(result.id), {
      status: 'published', publishedAt: timestamp, publishedBy: actorId, ...updated(actorId)
    });
    batch.set(db.collection('publications').doc(`${exam.id}_${result.studentId}`), {
      examId: exam.id, studentId: result.studentId, classId: exam.classId,
      studentIds: [result.studentId], publishedBy: actorId, publishedAt: timestamp,
      explanationAvailableAt: revealAt, revealAtMs: new Date(revealAt).getTime(), ...stamp(actorId)
    }, { merge: true });
  }
  await batch.commit();
  return results.length;
}

async function main() {
  const { db } = initAdmin();
  let examsQuery = db.collection('exams');
  if (examFilter) examsQuery = examsQuery.where('__name__', '==', examFilter);
  const exams = examFilter
    ? [await db.collection('exams').doc(examFilter).get()].filter((doc) => doc.exists).map((doc) => ({ id: doc.id, ...doc.data() }))
    : (await examsQuery.get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (examFilter && !exams.length) throw new Error(`Ujian tidak ditemukan: ${examFilter}`);
  let gradedCount = 0;
  let publishedCount = 0;

  for (const exam of exams) {
    const links = (await db.collection('exam_questions').where('examId', '==', exam.id).get()).docs
      .map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.order - b.order);
    const questionDocs = await Promise.all(links.map((link) => db.collection('questions').doc(link.questionId).get()));
    const questions = questionDocs.filter((doc) => doc.exists).map((doc) => ({ id: doc.id, ...doc.data() }));
    const attempts = (await db.collection('exam_attempts').where('examId', '==', exam.id).get()).docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((attempt) => attempt.status === 'submitted' || attempt.status === 'awaiting_review');
    const answers = (await db.collection('exam_answers').where('examId', '==', exam.id).get()).docs
      .map((doc) => ({ id: doc.id, ...doc.data() }));

    for (const attempt of attempts) {
      const items = links.map((link) => {
        const question = questions.find((item) => item.id === link.questionId) ?? {};
        return {
          questionId: link.questionId, type: link.type, weight: link.weight,
          answerKey: link.answerKey ?? [], acceptedAnswers: question.acceptedAnswers ?? [],
          gradingMethod: question.gradingMethod, partialCreditRule: question.partialCreditRule,
          requiresManualReview: Boolean(question.requiresManualReview),
          whitespaceTolerance: question.whitespaceTolerance
        };
      });
      const evaluations = items.map((item) => evaluateItem(item, answers.find((answer) => answer.attemptId === attempt.id && answer.questionId === item.questionId)?.answer ?? []));
      const autoScore = round(evaluations.reduce((sum, item) => sum + item.earned, 0), 2);
      const maxScore = round(evaluations.reduce((sum, item) => sum + item.max, 0), 2);
      const percentage = maxScore ? round(autoScore / maxScore * 100, 2) : 0;
      const needsReview = evaluations.some((item) => item.needsManualReview);
      const status = needsReview ? 'awaiting_review' : 'graded';
      const resultRef = db.collection('exam_results').doc(attempt.id);
      const existing = await resultRef.get();
      await resultRef.set({
        attemptId: attempt.id, examId: exam.id, studentId: attempt.studentId,
        classId: exam.classId, subjectId: exam.subjectId,
        answers: evaluations, autoScore, finalScore: percentage, maxScore: 100,
        passed: percentage >= (exam.passingScore ?? 70), gradedBy: actorId,
        gradedAt: new Date().toISOString(), status,
        ...(existing.exists ? updated(actorId) : stamp(actorId))
      }, { merge: true });
      await resultRef.update({ status });
      await db.collection('exam_attempts').doc(attempt.id).update({ status, ...updated(actorId) });
      gradedCount += 1;
    }

    const allResults = (await db.collection('exam_results').where('examId', '==', exam.id).get()).docs
      .map((doc) => ({ id: doc.id, ...doc.data() }));
    const analyses = analyzeItems({ links, questions, results: allResults, answers });
    const analysisBatch = db.batch();
    for (const analysis of analyses) {
      const ref = db.collection('item_analyses').doc(`${exam.id}_${analysis.questionId}`);
      const snapshot = await ref.get();
      analysisBatch.set(ref, { ...analysis, ...(snapshot.exists ? { notes: snapshot.data().notes } : {}), ...(snapshot.exists ? updated(actorId) : stamp(actorId)) }, { merge: true });
    }
    if (analyses.length) await analysisBatch.commit();

    if (shouldPublish) {
      const ready = allResults.filter((result) => result.status !== 'awaiting_review');
      publishedCount += await publish(db, exam, ready, force);
    }
    console.log(`Ujian ${exam.name || exam.id}: ${attempts.length} dinilai, ${analyses.length} analisis diperbarui.`);
  }

  console.log(`Selesai: ${gradedCount} percobaan dinilai${shouldPublish ? `, ${publishedCount} hasil dipublikasikan` : ''}.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
