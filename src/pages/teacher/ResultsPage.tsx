import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, Send } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection } from '@/hooks/useCollection';
import { db } from '@/services/db';
import { COLLECTIONS } from '@/services/repository';
import { gradeAttempt, publicationReadiness, publishResults, recomputeItemAnalysis, updateManualScore } from '@/services/scoring/results';
import { getExamLinks } from '@/services/exams';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Loading, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import type { Exam, ExamAnswer, ExamAssignment, ExamAttempt, ExamResult, Question, Student } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Belum dikerjakan', in_progress: 'Sedang dikerjakan', submitted: 'Sudah dikumpulkan',
  awaiting_review: 'Menunggu pemeriksaan', graded: 'Sudah dinilai', published: 'Sudah dipublikasikan'
};

export default function ResultsPage() {
  const { user, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const examId = params.get('exam') ?? '';
  const exams = useCollection<Exam>(COLLECTIONS.exams);
  const assignments = useCollection<ExamAssignment>(COLLECTIONS.assignments);
  const attempts = useCollection<ExamAttempt>(COLLECTIONS.attempts);
  const results = useCollection<ExamResult>(COLLECTIONS.results);
  const students = useCollection<Student>(COLLECTIONS.students);
  const [busy, setBusy] = useState('');
  const [reviewing, setReviewing] = useState<ExamResult | null>(null);
  const [reviewScore, setReviewScore] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [detail, setDetail] = useState<ExamResult | null>(null);
  const [detailAnswers, setDetailAnswers] = useState<ExamAnswer[]>([]);
  const [issues, setIssues] = useState<string[]>([]);

  const exam = exams.data.find((item) => item.id === examId) ?? null;
  const examAssignments = assignments.data.filter((item) => item.examId === examId);
  const names = useMemo(() => new Map(students.data.map((student) => [student.uid, student.name])), [students.data]);

  const rows = examAssignments.map((assignment) => {
    const attempt = attempts.data.filter((item) => item.examId === examId && item.studentId === assignment.studentId)
      .sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null;
    const result = attempt ? results.data.find((item) => item.attemptId === attempt.id) ?? null : null;
    return { assignment, attempt, result };
  });

  const checkReadiness = async (currentResults?: ExamResult[]) => {
    if (!exam) return;
    const links = await getExamLinks(exam.id);
    const questions = await Promise.all(links.map((link) => db.get<Question>(COLLECTIONS.questions, link.questionId)));
    const source = currentResults ?? await db.list<ExamResult>(COLLECTIONS.results, {
      filters: [{ field: 'examId', op: '==', value: exam.id }]
    });
    setIssues(publicationReadiness(exam, links, questions.filter((item): item is Question => Boolean(item)), source.filter((item) => item.examId === exam.id)));
  };

  const handleGrade = async (attempt: ExamAttempt) => {
    if (!exam) return;
    setBusy(attempt.id);
    try {
      await gradeAttempt(exam, attempt.id, user?.uid ?? 'system');
      await recomputeItemAnalysis(exam, user?.uid ?? 'system');
      notify('Jawaban berhasil dinilai.', 'success');
      await Promise.all([results.refresh(), attempts.refresh()]);
      await checkReadiness(await db.list<ExamResult>(COLLECTIONS.results, {
        filters: [{ field: 'examId', op: '==', value: exam.id }]
      }));
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal menilai.', 'error'); }
    finally { setBusy(''); }
  };

  const handlePublish = async (studentIds: string[]) => {
    if (!exam) return;
    setBusy('publish');
    try {
      const count = await publishResults(exam, studentIds, user?.uid ?? 'system');
      notify(`${count} nilai berhasil dipublikasikan.`, 'success');
      await results.refresh();
      await checkReadiness(await db.list<ExamResult>(COLLECTIONS.results, {
        filters: [{ field: 'examId', op: '==', value: exam.id }]
      }));
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal mempublikasi.', 'error'); }
    finally { setBusy(''); }
  };

  const openReview = (result: ExamResult) => {
    setReviewing(result);
    setReviewScore(String(result.finalScore));
    setReviewNote(result.note ?? '');
  };

  const openDetail = async (result: ExamResult) => {
    setDetail(result);
    setDetailAnswers(await db.list<ExamAnswer>(COLLECTIONS.answers, { filters: [{ field: 'attemptId', op: '==', value: result.attemptId }] }));
  };

  if (exams.loading || assignments.loading || attempts.loading || results.loading || students.loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Hasil Ujian" description="Periksa jawaban, koreksi nilai, dan publikasikan hasil kepada siswa." actions={<Select value={examId} onChange={(event) => { setParams({ exam: event.target.value }); setIssues([]); }} className="w-64"><option value="">— Pilih ujian —</option>{exams.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>} />
      {!exam ? <Card><EmptyState title="Pilih ujian" description="Pilih ujian untuk melihat hasil peserta." /></Card> : <>
        <Card className="mb-5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-bold text-navy-900">{exam.name}</p><p className="text-xs text-slate-500">{formatDateTime(exam.startAt)} · KKM {exam.passingScore}</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void checkReadiness()}>Periksa kesiapan</Button>
              <Button onClick={() => void handlePublish(examAssignments.map((item) => item.studentId))} loading={busy === 'publish'}><Send className="h-4 w-4" /> Publikasi satu kelas</Button>
            </div>
          </div>
          {issues.length > 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><p className="font-semibold">Belum siap dipublikasikan:</p><ul className="list-inside list-disc">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
          {issues.length === 0 && <p className="mt-3 text-sm text-emerald-700">✓ Semua hasil siap dipublikasikan.</p>}
        </Card>
        <Card>
          <CardHeader title="Rekap peserta" description={`${rows.length} siswa ditugaskan pada ujian ini`} />
          {rows.length === 0 ? <EmptyState title="Belum ada peserta" /> : (
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th>Siswa</th><th>Status</th><th>Percobaan</th><th>Nilai</th><th>Dikumpulkan</th><th>Aksi</th></tr></thead>
              <tbody>{rows.map(({ assignment, attempt, result }) => {
                const status = result?.status ?? attempt?.status ?? 'not_started';
                return <tr key={assignment.id}>
                  <td className="font-semibold">{names.get(assignment.studentId) ?? assignment.studentId}</td>
                  <td><Badge tone={status === 'published' ? 'green' : status === 'awaiting_review' ? 'amber' : status === 'graded' ? 'blue' : 'slate'}>{STATUS_LABEL[status] ?? status}</Badge></td>
                  <td>{attempt?.attemptNumber ?? 0} / {exam.maxAttempts}</td>
                  <td>{result ? `${result.finalScore}` : '—'}</td>
                  <td className="text-xs">{attempt?.submittedAt ? formatDateTime(attempt.submittedAt) : '—'}</td>
                  <td><div className="flex flex-wrap gap-1">
                    {attempt?.status === 'submitted' && <Button size="sm" variant="secondary" loading={busy === attempt.id} onClick={() => void handleGrade(attempt)}>Nilai otomatis</Button>}
                    {result && <Button size="sm" variant="secondary" onClick={() => openReview(result)}>Koreksi</Button>}
                    {result && <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Detail" onClick={() => void openDetail(result)}><Eye className="h-4 w-4" /></button>}
                    {result && result.status !== 'published' && <Button size="sm" onClick={() => void handlePublish([result.studentId])} loading={busy === 'publish'}><CheckCircle2 className="h-4 w-4" /> Publikasi</Button>}
                  </div></td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
        </Card>
      </>}

      <Modal open={Boolean(reviewing)} title="Koreksi nilai" onClose={() => setReviewing(null)} width="max-w-lg">
        {reviewing && <div className="space-y-4">
          <p className="text-sm text-slate-600">Nilai otomatis: <strong>{reviewing.autoScore}</strong> dari {reviewing.maxScore}. Skor akhir 0–100.</p>
          <Input label="Nilai akhir" type="number" min={0} max={100} value={reviewScore} onChange={(event) => setReviewScore(event.target.value)} />
          <Textarea label="Catatan guru" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setReviewing(null)}>Batal</Button><Button onClick={async () => {
            try {
              await updateManualScore(reviewing, Number(reviewScore), reviewNote, user?.uid ?? 'system');
              notify('Nilai diperbarui.', 'success'); setReviewing(null); await results.refresh();
            } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal.', 'error'); }
          }}>Simpan nilai</Button></div>
        </div>}
      </Modal>

      <Modal open={Boolean(detail)} title="Detail jawaban siswa" onClose={() => setDetail(null)}>
        {detail && <div className="space-y-3">
          <p className="text-sm text-slate-600">Nilai akhir: <strong>{detail.finalScore}</strong> · Status: {detail.status}</p>
          {detail.answers.map((answer) => {
            const studentAnswer = detailAnswers.find((item) => item.questionId === answer.questionId);
            return <div key={answer.questionId} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-mono text-xs text-slate-500">{answer.questionId}</p>
              <p>Jawaban siswa: {studentAnswer?.answer.join(', ') || '(kosong)'}</p>
              <p>Skor: {answer.earned} / {answer.max} {answer.needsManualReview ? '· perlu pemeriksaan' : ''}</p>
            </div>;
          })}
          {detail.note && <p className="rounded-xl bg-slate-50 p-3 text-sm">Catatan: {detail.note}</p>}
        </div>}
      </Modal>
    </div>
  );
}
