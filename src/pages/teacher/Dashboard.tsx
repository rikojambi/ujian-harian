import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpenCheck, CheckCircle2, ClipboardList, FileQuestion, TrendingUp, Users, UserCheck
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '@/contexts/AppContext';
import { useCollection } from '@/hooks/useCollection';
import { Badge, Card, CardHeader, EmptyState, Loading, PageHeader, StatCard } from '@/components/ui';
import { COLLECTIONS } from '@/services/repository';
import { formatDate, formatNumber } from '@/utils/format';
import type { Exam, ExamAssignment, ExamAttempt, ExamResult, Question } from '@/types';

export default function TeacherDashboard() {
  const { profile } = useApp();
  const questions = useCollection<Question>(COLLECTIONS.questions);
  const exams = useCollection<Exam>(COLLECTIONS.exams);
  const assignments = useCollection<ExamAssignment>(COLLECTIONS.assignments);
  const attempts = useCollection<ExamAttempt>(COLLECTIONS.attempts);
  const results = useCollection<ExamResult>(COLLECTIONS.results);

  if (questions.loading || exams.loading || assignments.loading || attempts.loading || results.loading) return <Loading />;
  const mine = (item: { teacherId?: string }) => !profile || !item.teacherId || item.teacherId === profile.uid || profile.role === 'admin';
  const myQuestions = questions.data.filter(mine);
  const myExams = exams.data.filter(mine);
  const myExamIds = new Set(myExams.map((exam) => exam.id));
  const myAssignments = assignments.data.filter((item) => myExamIds.has(item.examId));
  const myAttempts = attempts.data.filter((item) => myExamIds.has(item.examId));
  const myResults = results.data.filter((item) => myExamIds.has(item.examId));
  const finished = myAttempts.filter((item) => item.status !== 'in_progress' && item.status !== 'not_started');
  const average = myResults.length ? myResults.reduce((sum, item) => sum + item.finalScore, 0) / myResults.length : 0;
  const passed = myResults.filter((item) => item.passed).length;
  const chartData = [...myResults]
    .sort((a, b) => a.gradedAt.localeCompare(b.gradedAt))
    .slice(-12)
    .map((result) => ({
      tanggal: formatDate(result.gradedAt),
      nilai: Math.round(result.finalScore * 10) / 10
    }));

  return (
    <div>
      <PageHeader
        title={`Selamat datang, ${profile?.name?.split(' ')[0] ?? 'Guru'}`}
        description="Ringkasan aktivitas ujian harian dan kinerja siswa."
        actions={<Link to="/guru/buat-ujian" className="btn-primary"><ClipboardList className="h-4 w-4" /> Buat Ujian</Link>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bank soal aktif" value={myQuestions.filter((item) => item.status === 'active').length} icon={<FileQuestion className="h-5 w-5" />} />
        <StatCard label="Ujian aktif" value={myExams.filter((item) => item.status === 'active').length} icon={<BookOpenCheck className="h-5 w-5" />} tone="green" />
        <StatCard label="Peserta ujian" value={myAssignments.length} icon={<Users className="h-5 w-5" />} tone="violet" />
        <StatCard label="Sudah mengerjakan" value={finished.length} icon={<UserCheck className="h-5 w-5" />} tone="amber" />
        <StatCard label="Belum mengerjakan" value={Math.max(0, myAssignments.length - finished.length)} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Rata-rata nilai" value={formatNumber(average)} icon={<TrendingUp className="h-5 w-5" />} tone="green" />
        <StatCard label="Persentase ketuntasan" value={`${myResults.length ? Math.round((passed / myResults.length) * 100) : 0}%`} icon={<CheckCircle2 className="h-5 w-5" />} tone="violet" />
        <StatCard label="Menunggu pemeriksaan" value={myResults.filter((item) => item.status === 'awaiting_review').length} icon={<ClipboardList className="h-5 w-5" />} tone="amber" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Perkembangan hasil ujian" description="Rata-rata 12 hasil terakhir" />
          {chartData.length ? (
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <defs><linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value}`, 'Nilai']} />
                  <Area type="monotone" dataKey="nilai" stroke="#2563eb" fill="url(#scoreGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Belum ada hasil ujian" description="Grafik akan muncul setelah siswa mengumpulkan jawaban dan guru menilainya." />}
        </Card>
        <Card>
          <CardHeader title="Aksi cepat" description="Menu yang sering digunakan" />
          <div className="space-y-2 p-4">
            {[
              { to: '/guru/bank-soal', label: 'Kelola bank soal' },
              { to: '/guru/import', label: 'Impor soal dari Word/RTF' },
              { to: '/guru/tp', label: 'Atur Tujuan Pembelajaran' },
              { to: '/guru/hasil', label: 'Periksa dan publikasi nilai' },
              { to: '/guru/analisis-butir', label: 'Analisis kualitas soal' }
            ].map((item) => (
              <Link key={item.to} to={item.to} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-sm font-medium text-navy-800 hover:bg-slate-50">
                {item.label}<ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Ujian terbaru" action={<Link to="/guru/ujian" className="link text-sm">Lihat semua</Link>} />
        {myExams.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Ujian</th><th>Kelas</th><th>Jadwal</th><th>Status</th><th>Peserta</th></tr></thead>
              <tbody>{[...myExams].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((exam) => (
                <tr key={exam.id}>
                  <td className="font-semibold">{exam.name}</td>
                  <td>{exam.classId}</td>
                  <td>{formatDate(exam.startAt)}</td>
                  <td><Badge tone={exam.status === 'active' ? 'green' : exam.status === 'draft' ? 'slate' : 'amber'}>{exam.status}</Badge></td>
                  <td>{assignments.data.filter((item) => item.examId === exam.id).length}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Belum ada ujian" description="Buat ujian pertama Anda untuk mulai mendistribusikan soal kepada siswa." />}
      </Card>
    </div>
  );
}
