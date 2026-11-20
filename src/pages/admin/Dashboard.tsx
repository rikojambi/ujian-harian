import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, GraduationCap, Users } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { Card, CardHeader, EmptyState, Loading, PageHeader, StatCard } from '@/components/ui';
import { COLLECTIONS } from '@/services/repository';
import type { Exam, Question, SchoolClass, UserProfile } from '@/types';

export default function AdminDashboard() {
  const users = useCollection<UserProfile>(COLLECTIONS.users);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const questions = useCollection<Question>(COLLECTIONS.questions);
  const exams = useCollection<Exam>(COLLECTIONS.exams);
  if (users.loading || classes.loading || questions.loading || exams.loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Dashboard Administrator" description="Pengelolaan akun, kelas, mata pelajaran, dan seluruh data ujian." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total akun" value={users.data.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Guru" value={users.data.filter((item) => item.role === 'teacher').length} icon={<GraduationCap className="h-5 w-5" />} tone="green" />
        <StatCard label="Siswa" value={users.data.filter((item) => item.role === 'student').length} icon={<Users className="h-5 w-5" />} tone="violet" />
        <StatCard label="Kelas" value={classes.data.length} icon={<BookOpen className="h-5 w-5" />} tone="amber" />
        <StatCard label="Bank soal" value={questions.data.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Ujian" value={exams.data.length} icon={<ClipboardList className="h-5 w-5" />} tone="green" />
      </div>
      <Card className="mt-5">
        <CardHeader title="Akses cepat" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { to: '/admin/pengguna', label: 'Kelola akun guru dan siswa' },
            { to: '/admin/kelas', label: 'Kelola kelas' },
            { to: '/admin/mata-pelajaran', label: 'Kelola mata pelajaran' },
            { to: '/admin/tahun-ajaran', label: 'Kelola tahun ajaran' },
            { to: '/admin/ujian', label: 'Lihat seluruh ujian' },
            { to: '/admin/pengaturan', label: 'Konfigurasi aplikasi' }
          ].map((item) => <Link key={item.to} to={item.to} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50">{item.label}</Link>)}
        </div>
      </Card>
      {users.data.length === 0 && <Card className="mt-5"><EmptyState title="Belum ada akun" description="Buat akun admin awal melalui prosedur bootstrap atau muat data contoh pada halaman masuk." /></Card>}
    </div>
  );
}
