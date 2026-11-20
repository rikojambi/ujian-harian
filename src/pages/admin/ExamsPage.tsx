import { Link } from 'react-router-dom';
import { useCollection } from '@/hooks/useCollection';
import { Badge, Card, EmptyState, Loading, PageHeader } from '@/components/ui';
import { COLLECTIONS } from '@/services/repository';
import { formatDateTime } from '@/utils/format';
import type { Exam } from '@/types';

export default function AdminExamsPage() {
  const exams = useCollection<Exam>(COLLECTIONS.exams);
  return (
    <div>
      <PageHeader title="Seluruh Ujian" description="Pantau semua ujian yang dibuat oleh guru." />
      <Card>
        {exams.loading ? <Loading /> : exams.data.length === 0 ? <EmptyState title="Belum ada ujian" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>Nama ujian</th><th>Guru</th><th>Jadwal</th><th>Soal</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{exams.data.map((exam) => <tr key={exam.id}>
              <td className="font-semibold">{exam.name}</td>
              <td>{exam.teacherId}</td>
              <td>{formatDateTime(exam.startAt)}</td>
              <td>{exam.questionCount}</td>
              <td><Badge tone={exam.status === 'active' ? 'green' : 'slate'}>{exam.status}</Badge></td>
              <td><Link className="link text-sm" to={`/guru/hasil?exam=${exam.id}`}>Lihat hasil</Link></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
