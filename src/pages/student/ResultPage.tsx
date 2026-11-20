import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, EyeOff } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/services/db';
import { COLLECTIONS } from '@/services/repository';
import { getPublishedResult } from '@/services/scoring/results';
import { buildStudentAnalysis } from '@/services/analytics/student';
import { MediaViewer } from '@/components/MediaViewer';
import { Badge, Card, EmptyState, Loading, PageHeader, StatCard } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import type { Exam, ExamAnswer, ExamAttempt, ExamResult, StudentAnalysis, StudentExplanationDoc, StudentQuestionDoc } from '@/types';

export default function ResultPage() {
  const { examId = '' } = useParams();
  const { user, notify } = useApp();
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [questions, setQuestions] = useState<StudentQuestionDoc[]>([]);
  const [explanations, setExplanations] = useState<StudentExplanationDoc[]>([]);
  const [mastery, setMastery] = useState<StudentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const foundExam = await db.get<Exam>(COLLECTIONS.exams, examId);
        setExam(foundExam);
        const attempts = await db.list<ExamAttempt>(COLLECTIONS.attempts, {
          filters: [{ field: 'examId', op: '==', value: examId }, { field: 'studentId', op: '==', value: user.uid }]
        });
        setAttempt(attempts.sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null);
        const published = await getPublishedResult(user.uid, examId);
        setResult(published);
        if (published) {
          setAnswers(await db.list<ExamAnswer>(COLLECTIONS.answers, { filters: [{ field: 'attemptId', op: '==', value: published.attemptId }] }));
          setQuestions(await db.list<StudentQuestionDoc>(COLLECTIONS.studentQuestions, { filters: [{ field: 'examId', op: '==', value: examId }] }));
          setExplanations(await db.list<StudentExplanationDoc>(COLLECTIONS.studentExplanations, { filters: [{ field: 'examId', op: '==', value: examId }] }));
          const analysis = await buildStudentAnalysis(user.uid, { subjectId: foundExam?.subjectId });
          setMastery(analysis.filter((item) => item.status !== 'dikuasai'));
        }
      } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal memuat hasil.', 'error'); }
      finally { setLoading(false); }
    })();
  }, [examId, user, notify]);

  if (loading) return <Loading />;
  if (!exam) return <Card className="p-6"><EmptyState title="Ujian tidak ditemukan" /></Card>;

  const explanationAllowed = Boolean(result && (
    exam.explanationMode === 'on_publish' || !exam.explanationAvailableAt || new Date(exam.explanationAvailableAt).getTime() <= Date.now()
  ));

  return (
    <div>
      <PageHeader title="Hasil Ujian" description={exam.name} actions={<Link to="/siswa/hasil" className="btn-secondary">Semua hasil</Link>} />
      {!attempt || attempt.status === 'in_progress' ? (
        <Card className="p-6"><EmptyState title="Ujian belum diselesaikan" description="Nilai dan pembahasan dapat dilihat setelah ujian dikumpulkan dan dinilai guru." action={<Link to={`/siswa/ujian/${exam.id}`} className="btn-primary">Buka ujian</Link>} /></Card>
      ) : !result ? (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-accent-600"><EyeOff className="h-7 w-7" /></div>
          <h2 className="mt-4 text-lg font-bold">Jawaban sudah dikumpulkan</h2>
          <p className="mt-2 text-sm text-slate-600">Status: <Badge tone="amber">{attempt.status.replaceAll('_', ' ')}</Badge></p>
          <p className="mt-3 text-sm text-slate-500">Nilai belum ditampilkan. Guru akan mempublikasikan hasil setelah proses penilaian selesai.</p>
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400"><Clock className="h-4 w-4" /> Dikumpulkan: {formatDateTime(attempt.submittedAt)}</p>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Nilai akhir" value={result.finalScore} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
            <StatCard label="Status kelulusan" value={result.passed ? 'Tuntas' : 'Belum tuntas'} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Dipublikasikan" value={formatDateTime(result.publishedAt)} icon={<Clock className="h-5 w-5" />} tone="violet" />
          </div>
          {mastery.length > 0 && <Card className="border-amber-200 p-4">
            <h2 className="font-bold text-amber-900">Materi yang perlu dipelajari kembali</h2>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">{mastery.map((item) => <li key={item.id}>• Capaian {item.percentage}% pada TP terpilih ({item.totalItems} soal). {item.evidenceSufficient ? 'Perlu penguatan.' : 'Bukti belum cukup, tambahkan latihan.'}</li>)}</ul>
          </Card>}
          <Card>
            <div className="border-b border-slate-100 p-4"><h2 className="section-title">Jawaban dan pembahasan</h2></div>
            <div className="space-y-3 p-4">{result.answers.map((evaluation, position) => {
              const question = questions.find((item) => item.questionId === evaluation.questionId);
              const explanation = explanations.find((item) => item.questionId === evaluation.questionId);
              const own = answers.find((item) => item.questionId === evaluation.questionId);
              const key = explanation?.correctAnswers ?? [];
              return <div key={evaluation.questionId} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">Soal {position + 1}</p>
                  <Badge tone={evaluation.earned >= evaluation.max ? 'green' : 'red'}>{evaluation.earned} / {evaluation.max}</Badge>
                </div>
                <p className="mt-2 text-sm">{question?.prompt ?? evaluation.questionId}</p>
                <p className="mt-2 text-sm">Jawabanmu: <strong>{own?.answer.join(', ') || '(kosong)'}</strong></p>
                {explanationAllowed && <>
                  <p className="mt-1 text-sm text-emerald-700">Kunci: <strong>{key.join(', ')}</strong></p>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">{explanation?.explanation || 'Pembahasan belum tersedia.'}</p>
                  {explanation?.explanationMedia?.map((asset) => <div key={asset.id} className="mt-2"><MediaViewer asset={asset} /></div>)}
                </>}
                {!explanationAllowed && <p className="mt-2 text-xs text-slate-500">Pembahasan dibuka pada {formatDateTime(exam.explanationAvailableAt)}.</p>}
              </div>;
            })}</div>
          </Card>
        </div>
      )}
    </div>
  );
}
