import { EntityManager, ActiveBadge } from '@/components/EntityManager';
import { useCollection } from '@/hooks/useCollection';
import { COLLECTIONS } from '@/services/repository';
import type { AcademicYear, Teacher } from '@/types';

export default function AdminClassesPage() {
  const years = useCollection<AcademicYear>(COLLECTIONS.academicYears);
  const teachers = useCollection<Teacher>(COLLECTIONS.teachers);
  return (
    <EntityManager
      title="Kelola Kelas"
      description="Kelas yang digunakan untuk pengelompokan siswa dan ujian."
      collection={COLLECTIONS.classes}
      addLabel="Tambah kelas"
      fields={[
        { key: 'name', label: 'Nama kelas', required: true, placeholder: 'XI RPL 1' },
        { key: 'level', label: 'Tingkat', required: true, placeholder: 'X, XI, XII' },
        { key: 'major', label: 'Jurusan / Program keahlian' },
        { key: 'academicYearId', label: 'Tahun ajaran', type: 'select', required: true, options: years.data.map((item) => ({ value: item.id, label: `${item.name} (${item.semester})` })) },
        { key: 'homeroomTeacherId', label: 'Wali kelas', type: 'select', options: teachers.data.map((item) => ({ value: item.uid, label: item.name })) },
        { key: 'active', label: 'Aktif', type: 'checkbox', defaultValue: true }
      ]}
      columns={[
        { key: 'name', label: 'Kelas' },
        { key: 'level', label: 'Tingkat' },
        { key: 'major', label: 'Jurusan' },
        { key: 'active', label: 'Status', render: (row) => <ActiveBadge value={row.active} /> }
      ]}
      searchKeys={['name', 'level', 'major']}
    />
  );
}
