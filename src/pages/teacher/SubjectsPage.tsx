import { EntityManager, ActiveBadge } from '@/components/EntityManager';

export default function TeacherSubjectsPage() {
  return (
    <EntityManager
      title="Mata Pelajaran"
      description="Mata pelajaran yang diampu dan dipakai dalam bank soal."
      collection="subjects"
      addLabel="Tambah mapel"
      fields={[
        { key: 'name', label: 'Nama mata pelajaran', required: true },
        { key: 'code', label: 'Kode', required: true },
        { key: 'description', label: 'Deskripsi', type: 'textarea' },
        { key: 'active', label: 'Aktif', type: 'checkbox', defaultValue: true }
      ]}
      columns={[
        { key: 'name', label: 'Mata pelajaran' },
        { key: 'code', label: 'Kode' },
        { key: 'description', label: 'Deskripsi' },
        { key: 'active', label: 'Status', render: (row) => <ActiveBadge value={row.active} /> }
      ]}
      searchKeys={['name', 'code']}
    />
  );
}
