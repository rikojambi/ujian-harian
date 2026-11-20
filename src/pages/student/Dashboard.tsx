import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ClipboardList, Clock } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { getAssignedExams } from '@/services/exams';
import { useEffect, useState } from 'react';
import { Badge, Card, EmptyState, Loading, PageHeader, StatCard } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import type { Exam, ExamAssignment, ExamAttempt } from '@/types';

type Row = { exam: Exam; assignment: ExamAssignment; attempt: ExamAttempt | null };

export default function StudentDashboard() {
  const { user, profile } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAssignedExams(user.uid).then(setRows).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <Loading />;
  const available = rows.filter((row) => row.exam.status === 'active' && new Date(row.exam.endAt).getTime() > Date.now());
  const completed = rows.filter((row) => row.attempt && ['submitted', 'awaiting_review', 'graded', 'published'].includes(row.attempt.status));
  const resultsReady = rows.filter((row) => row.attempt?.status === 'published');

  return (
    <div>
      <PageHeader title={`Halo, ${profile?.name?.split(' ')[0] ?? 'Siswa'}`} description="Pantau ujian yang ditugaskan kepadamu." />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Ujian tersedia" value={available.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Sudah dikerjakan" value={completed.length} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Nilai terbit" value={resultsReady.length} icon={<CalendarDays className="h-5 w-5" />} tone="violet" />
      </div>
      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-slate-100 p-4"><h2 className="section-title">Ujian terdekat</h2><Link className="link text-sm" to="/siswa/ujian">Lihat semua</Link></div>
        {rows.length === 0 ? <EmptyState title="Belum ada ujian" description="Ujian yang ditugaskan guru akan muncul di sini." /> : (
          <div className="space-y-3 p-4">{rows.slice(0, 5).map(({ exam, attempt }) => (
            <div key={exam.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div><p className="font-semibold">{exam.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" /> {formatDateTime(exam.startAt)} — {formatDateTime(exam.endAt)}</p></div>
              <div className="flex items-center gap-2"><Badge tone={attempt?.status === 'published' ? 'green' : attempt ? 'blue' : 'slate'}>{attempt?.status?.replaceAll('_', ' ') ?? 'belum dikerjakan'}</Badge><Link to={`/siswa/ujian/${exam.id}`} className="btn-primary px-3 py-2 text-xs">Lihat ujian</Link></div>
            </div>
          ))}</div>
        )}
      </Card>
    </div>
  );
}
