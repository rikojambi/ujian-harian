import { EntityManager } from '@/components/EntityManager';
import { Badge, Card } from '@/components/ui';
import { isLocalMode } from '@/services/db';
import { mediaConfig } from '@/services/media';

export default function TeacherSettingsPage() {
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="section-title">Pengaturan aplikasi</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Penyimpanan:</span> <Badge tone={isLocalMode ? 'violet' : 'green'}>{isLocalMode ? 'Lokal' : 'Firebase'}</Badge></p>
          <p><span className="text-slate-500">Mode media:</span> {mediaConfig.mode}</p>
          <p><span className="text-slate-500">Batas gambar:</span> {(mediaConfig.maxImageBytes / 1048576).toFixed(1)} MB</p>
          <p><span className="text-slate-500">Batas video:</span> {(mediaConfig.maxVideoBytes / 1048576).toFixed(1)} MB / {mediaConfig.maxVideoSeconds} detik</p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">Ambang ketercapaian TP dan jumlah soal minimum diatur pada halaman Analisis Siswa. Konfigurasi global dapat ditambahkan pada pengaturan berikut.</p>
      </Card>
      <EntityManager
        title="Konfigurasi Global (app_settings)"
        description="Simpan nilai konfigurasi tambahan dalam bentuk teks/JSON."
        collection="app_settings"
        addLabel="Tambah pengaturan"
        fields={[
          { key: 'key', label: 'Kunci', required: true },
          { key: 'value', label: 'Nilai', type: 'textarea', required: true }
        ]}
        columns={[{ key: 'key', label: 'Kunci' }, { key: 'value', label: 'Nilai' }]}
      />
    </div>
  );
}
