import { EntityManager, ActiveBadge } from '@/components/EntityManager';
import { useCollection } from '@/hooks/useCollection';
import { COLLECTIONS } from '@/services/repository';
import type { AcademicYear, SchoolClass, Subject } from '@/types';

export default function ObjectivesPage() {
  const subjects = useCollection<Subject>(COLLECTIONS.subjects);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const years = useCollection<AcademicYear>(COLLECTIONS.academicYears);
  return (
    <EntityManager
      title="Tujuan Pembelajaran"
      description="Setiap soal dapat dihubungkan dengan satu atau beberapa TP."
      collection={COLLECTIONS.learningObjectives}
      addLabel="Tambah TP"
      fields={[
        { key: 'code', label: 'Kode TP', required: true, placeholder: 'TP-MAT-01' },
        { key: 'description', label: 'Deskripsi TP', type: 'textarea', required: true },
        { key: 'subjectId', label: 'Mata pelajaran', type: 'select', required: true, options: subjects.data.map((item) => ({ value: item.id, label: item.name })) },
        { key: 'classId', label: 'Kelas', type: 'select', required: true, options: classes.data.map((item) => ({ value: item.id, label: item.name })) },
        { key: 'academicYearId', label: 'Tahun ajaran', type: 'select', options: years.data.map((item) => ({ value: item.id, label: item.name })) },
        { key: 'semester', label: 'Semester', type: 'select', defaultValue: 'ganjil', options: [{ value: 'ganjil', label: 'Ganjil' }, { value: 'genap', label: 'Genap' }] },
        { key: 'material', label: 'Materi', required: true, placeholder: 'Lingkaran' },
        { key: 'active', label: 'Aktif', type: 'checkbox', defaultValue: true }
      ]}
      columns={[
        { key: 'code', label: 'Kode' },
        { key: 'description', label: 'Deskripsi' },
        { key: 'subjectId', label: 'Mapel', render: (row) => subjects.data.find((item) => item.id === row.subjectId)?.name ?? '—' },
        { key: 'material', label: 'Materi' },
        { key: 'active', label: 'Status', render: (row) => <ActiveBadge value={row.active} /> }
      ]}
      searchKeys={['code', 'description', 'material']}
    />
  );
}
