import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, WifiOff } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useDebounce } from '@/hooks/useCollection';
import { db } from '@/services/db';
import { COLLECTIONS } from '@/services/repository';
import { examWindow, getExamLinks, prepareStudentQuestions, saveAnswer, startAttempt, submitAttempt, type StudentQuestion } from '@/services/exams';
import { MediaViewer } from '@/components/MediaViewer';
import { Badge, Button, Card, ConfirmDialog, ErrorState, Input, Loading, PageHeader, Textarea } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import type { Exam, ExamAnswer, ExamAssignment, ExamAttempt } from '@/types';

export default function ExamPage() {
  const { examId = '' } = useParams();
  const { user, notify } = useApp();
  const [exam, setExam] = useState<Exam | null>(null);
  const [assignment, setAssignment] = useState<ExamAssignment | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const autoSubmitted = useRef(false);
  const initialized = useRef(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const foundExam = await db.get<Exam>(COLLECTIONS.exams, examId);
      if (!foundExam) throw new Error('Ujian tidak ditemukan.');
      const assignments = await db.list<ExamAssignment>(COLLECTIONS.assignments, {
        filters: [{ field: 'examId', op: '==', value: examId }, { field: 'studentId', op: '==', value: user.uid }]
      });
      if (!assignments.length) throw new Error('Ujian ini tidak ditugaskan kepadamu.');
      const attempts = await db.list<ExamAttempt>(COLLECTIONS.attempts, {
        filters: [{ field: 'examId', op: '==', value: examId }, { field: 'studentId', op: '==', value: user.uid }]
      });
      const active = attempts.find((item) => item.status === 'in_progress')
        ?? attempts.sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null;
      setExam(foundExam);
      setAssignment(assignments[0]);
      setAttempt(active);
      if (active) {
        const links = await getExamLinks(examId);
        setQuestions(await prepareStudentQuestions(foundExam, active, links));
        const savedAnswers = await db.list<ExamAnswer>(COLLECTIONS.answers, { filters: [{ field: 'attemptId', op: '==', value: active.id }] });
        setAnswers(Object.fromEntries(savedAnswers.map((answer) => [answer.questionId, answer.answer])));
        setFlagged(new Set(active.flaggedQuestionIds));
        setIndex(active.currentQuestionIndex || 0);
        setSubmitted(active.status !== 'in_progress');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal memuat ujian.');
    } finally { setLoading(false); }
  }, [examId, user]);

  useEffect(() => { void load(); }, [load]);

  const handleStart = async () => {
    if (!exam || !assignment || !user) return;
    setStarting(true);
    try {
      const created = await startAttempt(exam, assignment, user.uid, user.uid);
      setAttempt(created);
      const links = await getExamLinks(examId);
      setQuestions(await prepareStudentQuestions(exam, created, links));
      setAnswers({});
      setFlagged(new Set());
      setIndex(0);
      notify('Ujian dimulai. Jawaban disimpan otomatis.', 'success');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Gagal memulai ujian.'); }
    finally { setStarting(false); }
  };

  const deadline = useMemo(() => {
    if (!exam || !attempt) return 0;
    const byWindow = new Date(exam.endAt).getTime();
    const byDuration = new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60000;
    return Math.min(byWindow, byDuration);
  }, [exam, attempt]);

  useEffect(() => {
    if (!deadline || submitted) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !autoSubmitted.current && attempt) {
        autoSubmitted.current = true;
        void finalize(attempt, true);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, submitted, attempt?.id]);

  const debouncedAnswers = useDebounce(answers, 700);
  useEffect(() => {
    if (!attempt || !initialized.current || submitted) return;
    const changed = Object.entries(debouncedAnswers);
    if (!changed.length) return;
    void Promise.all(changed.map(([questionId, answer]) => saveAnswer(attempt, questionId, answer, user?.uid ?? 'system', flagged.has(questionId))))
      .then(() => db.update(COLLECTIONS.attempts, attempt.id, { lastSyncedAt: new Date().toISOString(), currentQuestionIndex: index }))
      .catch(() => notify('Jawaban belum tersinkron. Akan dicoba lagi saat koneksi kembali.', 'error'));
  }, [debouncedAnswers, attempt, flagged, index, submitted, notify, user?.uid]);

  useEffect(() => {
    if (questions.length) initialized.current = true;
  }, [questions.length]);

  const finalize = async (current: ExamAttempt, automatic = false) => {
    if (submitting || current.status !== 'in_progress') return;
    setSubmitting(true);
    try {
      const key = `submission-${current.id}`;
      const submissionId = localStorage.getItem(key) ?? `${current.id}_${Date.now()}`;
      localStorage.setItem(key, submissionId);
      await Promise.all(Object.entries(answers).map(([questionId, answer]) => saveAnswer(current, questionId, answer, user?.uid ?? 'system', flagged.has(questionId))));
      await submitAttempt(current, user?.uid ?? 'system', submissionId);
      setSubmitted(true);
      setSubmitOpen(false);
      notify(automatic ? 'Waktu habis. Jawaban otomatis dikumpulkan.' : 'Jawaban berhasil dikumpulkan.', 'success');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal mengumpulkan jawaban.');
    } finally { setSubmitting(false); }
  };

  if (error) return <ErrorState message={error} onRetry={() => { setError(''); void load(); }} />;
  if (loading) return <Loading label="Menyiapkan ujian…" />;
  if (!exam || !assignment) return <ErrorState message="Data ujian tidak tersedia." />;

  if (!attempt || attempt.status !== 'in_progress' || submitted || attempt.status !== 'in_progress') {
    const finished = attempt && attempt.status !== 'in_progress';
    return (
      <div>
        <PageHeader title={exam.name} description="Informasi ujian sebelum pengerjaan." />
        <Card className="mx-auto max-w-2xl p-6">
          <p className="whitespace-pre-wrap text-sm text-slate-600">{exam.description || 'Tidak ada deskripsi.'}</p>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="text-slate-500">Jumlah soal:</span> {exam.questionCount}</p>
            <p><span className="text-slate-500">Durasi:</span> {exam.durationMinutes} menit</p>
            <p><span className="text-slate-500">Mulai:</span> {formatDateTime(exam.startAt)}</p>
            <p><span className="text-slate-500">Selesai:</span> {formatDateTime(exam.endAt)}</p>
            <p><span className="text-slate-500">Percobaan:</span> {attempt?.attemptNumber ?? assignment.attemptCount + 1} dari {exam.maxAttempts}</p>
            <p><span className="text-slate-500">Status:</span> <Badge tone={finished ? 'green' : 'slate'}>{attempt?.status.replaceAll('_', ' ') ?? 'belum dikerjakan'}</Badge></p>
          </div>
          {finished ? <div className="mt-6 space-y-3">
            <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Jawabanmu sudah dikumpulkan. Nilai akan terlihat setelah guru mempublikasikan hasil.</p>
            <Link to={`/siswa/hasil/${exam.id}`} className="btn-primary w-full">Lihat status hasil</Link>
          </div> : <>
            <p className="mt-6 rounded-xl bg-blue-50 p-4 text-xs leading-relaxed text-accent-800">
              Ujian baru dimulai setelah validasi jadwal dan status peserta dari server. Jawaban disimpan otomatis setiap beberapa detik; bila koneksi terputus, jawaban akan disinkronkan kembali ketika online.
            </p>
            <Button className="mt-4 w-full" loading={starting} onClick={() => void handleStart()} disabled={examWindow(exam) !== 'open' || exam.status !== 'active'}>
              {examWindow(exam) === 'before' ? 'Belum memasuki jadwal' : examWindow(exam) === 'closed' ? 'Jadwal sudah berakhir' : 'Mulai mengerjakan'}
            </Button>
          </>}
          <Link to="/siswa/ujian" className="btn-ghost mt-3 w-full">Kembali ke daftar ujian</Link>
        </Card>
      </div>
    );
  }

  const current = questions[index];
  const answeredCount = questions.filter((question) => (answers[question.id] ?? []).length > 0).length;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const setAnswer = (value: string[]) => setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: value }));

  const toggleFlag = () => setFlagged((currentFlags) => {
    const next = new Set(currentFlags);
    if (next.has(current.id)) next.delete(current.id); else next.add(current.id);
    void db.update(COLLECTIONS.attempts, attempt.id, { flaggedQuestionIds: Array.from(next) });
    return next;
  });

  return (
    <div>
      <div className="sticky top-14 z-20 mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="font-bold text-navy-900">{exam.name}</p><p className="text-xs text-slate-500">{answeredCount}/{questions.length} soal dijawab</p></div>
          <div className="flex items-center gap-2">
            {!online && <Badge tone="amber"><WifiOff className="mr-1 h-3 w-3" /> Offline</Badge>}
            <span className={`flex items-center gap-1 rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${remaining < 300 ? 'bg-rose-100 text-rose-700' : 'bg-navy-50 text-navy-800'}`}><Clock className="h-4 w-4" /> {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
            <Button size="sm" variant="secondary" onClick={() => setSubmitOpen(true)}>Kumpulkan</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <Card className="p-5">
          {current && <>
            <div className="mb-4 flex items-center justify-between"><Badge tone="blue">Soal {index + 1} dari {questions.length}</Badge><button onClick={toggleFlag} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${flagged.has(current.id) ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}><Flag className="h-4 w-4" /> {flagged.has(current.id) ? 'Ditandai' : 'Tandai'}</button></div>
            {current.stimulus && <div className="mb-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{current.stimulus}</div>}
            <p className="whitespace-pre-wrap font-medium leading-relaxed">{current.prompt}</p>
            {current.media?.map((asset) => <div key={asset.id} className="mt-3"><MediaViewer asset={asset} /></div>)}
            <div className="mt-5 space-y-2">
              {current.type === 'completion' ? (
                <Input value={(answers[current.id] ?? [])[0] ?? ''} onChange={(event) => setAnswer([event.target.value])} placeholder="Ketik satu jawaban…" />
              ) : current.options.map((option) => {
                const selected = (answers[current.id] ?? []).includes(option.key);
                return <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${selected ? 'border-accent-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type={current.type === 'multiple_response' ? 'checkbox' : 'radio'}
                    name={`question-${current.id}`}
                    className="mt-0.5 h-5 w-5 accent-accent-500"
                    checked={selected}
                    onChange={() => {
                      if (current.type === 'completion') return;
                      const value = answers[current.id] ?? [];
                      if (current.type === 'multiple_response') setAnswer(selected ? value.filter((item) => item !== option.key) : [...value, option.key]);
                      else setAnswer([option.key]);
                    }}
                  />
                  <span className="flex-1"><span className="font-bold">{option.key}.</span> {option.text}{option.image && <MediaViewer asset={option.image} className="mt-2 max-h-40" />}</span>
                </label>;
              })}
            </div>
            <div className="mt-6 flex justify-between gap-2">
              <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft className="h-4 w-4" /> Sebelumnya</Button>
              <Button disabled={index >= questions.length - 1 || (exam.navigationMode === 'sequential' && !(answers[current.id] ?? []).length)} onClick={() => setIndex(index + 1)}>Berikutnya <ChevronRight className="h-4 w-4" /></Button>
            </div>
          </>}
        </Card>
        <Card className="h-fit p-4">
          <p className="label">Navigasi soal</p>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">{questions.map((question, position) => (
            <button key={question.id} onClick={() => {
              if (exam.navigationMode === 'sequential' && position > index && !(answers[current?.id ?? ''] ?? []).length) return;
              setIndex(position);
            }} className={`relative grid h-10 place-items-center rounded-lg text-sm font-semibold ${position === index ? 'bg-accent-500 text-white' : (answers[question.id] ?? []).length ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {position + 1}
              {flagged.has(question.id) && <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-amber-400 text-amber-600" />}
            </button>
          ))}</div>
          <div className="mt-4 space-y-1 text-xs text-slate-500">
            <p className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-100" /> Sudah dijawab</p>
            <p className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100" /> Belum dijawab</p>
            <p className="flex items-center gap-1"><Flag className="h-3 w-3 text-amber-600" /> Ditandai</p>
          </div>
          <Textarea className="mt-4 hidden" value="" readOnly />
        </Card>
      </div>

      <ConfirmDialog open={submitOpen} title="Akhiri ujian?" message={`Anda telah menjawab ${answeredCount} dari ${questions.length} soal. Setelah dikumpulkan, jawaban tidak dapat diubah.`} confirmLabel="Kumpulkan sekarang" onClose={() => setSubmitOpen(false)} onConfirm={() => { if (attempt) void finalize(attempt); }} loading={submitting} />
      {remaining < 300 && <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-rose-600"><AlertTriangle className="h-4 w-4" /> Segera kumpulkan jawaban, waktu hampir habis.</p>}
      <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><CheckCircle2 className="h-4 w-4" /> Jawaban disimpan otomatis. Kunci jawaban tidak dikirim ke perangkat ini.</p>
    </div>
  );
}
