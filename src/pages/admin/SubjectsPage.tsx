import { EntityManager, ActiveBadge } from '@/components/EntityManager';

export default function AdminSubjectsPage() {
  return (
    <EntityManager
      title="Mata Pelajaran"
      description="Daftar mata pelajaran yang digunakan di seluruh ujian."
      collection={COLLECTIONS_SUBJECTS}
      addLabel="Tambah mapel"
      fields={[
        { key: 'name', label: 'Nama mata pelajaran', required: true, placeholder: 'Matematika' },
        { key: 'code', label: 'Kode', required: true, placeholder: 'MTK' },
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

const COLLECTIONS_SUBJECTS = 'subjects';
