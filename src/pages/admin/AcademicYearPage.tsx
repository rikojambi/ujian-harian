import { EntityManager, ActiveBadge } from '@/components/EntityManager';

export default function AcademicYearPage() {
  return (
    <EntityManager
      title="Tahun Ajaran dan Semester"
      description="Periode akademik yang dipakai untuk mengelompokkan soal dan ujian."
      collection="academic_years"
      addLabel="Tambah periode"
      fields={[
        { key: 'name', label: 'Tahun ajaran', required: true, placeholder: '2026/2027' },
        { key: 'semester', label: 'Semester', type: 'select', required: true, defaultValue: 'ganjil', options: [{ value: 'ganjil', label: 'Ganjil' }, { value: 'genap', label: 'Genap' }] },
        { key: 'startDate', label: 'Tanggal mulai', type: 'date', required: true },
        { key: 'endDate', label: 'Tanggal selesai', type: 'date', required: true },
        { key: 'active', label: 'Aktif', type: 'checkbox', defaultValue: true }
      ]}
      columns={[
        { key: 'name', label: 'Tahun ajaran' },
        { key: 'semester', label: 'Semester' },
        { key: 'startDate', label: 'Mulai' },
        { key: 'endDate', label: 'Selesai' },
        { key: 'active', label: 'Status', render: (row) => <ActiveBadge value={row.active} /> }
      ]}
      searchKeys={['name', 'semester']}
    />
  );
}
