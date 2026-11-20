import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Play } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { examWindow, getAssignedExams } from '@/services/exams';
import { Badge, Card, EmptyState, Loading, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import type { Exam, ExamAssignment, ExamAttempt } from '@/types';

type Row = { exam: Exam; assignment: ExamAssignment; attempt: ExamAttempt | null };

export default function ExamListPage() {
  const { user } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAssignedExams(user.uid).then(setRows).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <Loading />;
  return (
    <div>
      <PageHeader title="Ujian Saya" description="Daftar ujian yang secara eksplisit ditugaskan kepadamu." />
      {rows.length === 0 ? <Card><EmptyState title="Belum ada ujian" description="Hubungi guru jika ada ujian yang seharusnya ditugaskan." /></Card> : (
        <div className="grid gap-3 md:grid-cols-2">{rows.map(({ exam, attempt }) => {
          const windowStatus = examWindow(exam);
          const finished = attempt && attempt.status !== 'in_progress';
          return <Card key={exam.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-navy-900">{exam.name}</h2><Badge tone={finished ? 'green' : windowStatus === 'open' ? 'blue' : 'slate'}>{finished ? attempt.status.replaceAll('_', ' ') : windowStatus === 'before' ? 'belum dimulai' : windowStatus === 'closed' ? 'ditutup' : 'tersedia'}</Badge></div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-500">{exam.description || 'Tidak ada deskripsi.'}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <p className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Mulai: {formatDateTime(exam.startAt)}</p>
              <p className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Selesai: {formatDateTime(exam.endAt)}</p>
              <p>{exam.questionCount} soal · {exam.durationMinutes} menit · percobaan {attempt?.attemptNumber ?? 0}/{exam.maxAttempts}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Link to={`/siswa/ujian/${exam.id}`} className="btn-primary flex-1"><Play className="h-4 w-4" /> {attempt?.status === 'in_progress' ? 'Lanjutkan' : 'Lihat detail'}</Link>
              {attempt && ['submitted', 'awaiting_review', 'graded', 'published'].includes(attempt.status) && <Link to={`/siswa/hasil/${exam.id}`} className="btn-secondary">Hasil</Link>}
            </div>
          </Card>;
        })}</div>
      )}
    </div>
  );
}
