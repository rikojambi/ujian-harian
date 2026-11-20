import { EntityManager } from '@/components/EntityManager';
import { Badge, Card } from '@/components/ui';
import { isLocalMode } from '@/services/db';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="section-title">Informasi sistem</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Mode penyimpanan:</span> <Badge tone={isLocalMode ? 'violet' : 'green'}>{isLocalMode ? 'Lokal / development' : 'Firebase Firestore'}</Badge></p>
          <p><span className="text-slate-500">Versi aplikasi:</span> 1.0.0</p>
        </div>
      </Card>
      <EntityManager
        title="Konfigurasi Aplikasi"
        description="Nilai konfigurasi disimpan sebagai dokumen app_settings."
        collection="app_settings"
        addLabel="Tambah pengaturan"
        fields={[
          { key: 'key', label: 'Kunci pengaturan', required: true, placeholder: 'tp_passing_threshold' },
          { key: 'value', label: 'Nilai (teks/JSON)', type: 'textarea', required: true }
        ]}
        columns={[{ key: 'key', label: 'Kunci' }, { key: 'value', label: 'Nilai' }]}
        searchKeys={['key']}
      />
    </div>
  );
}
