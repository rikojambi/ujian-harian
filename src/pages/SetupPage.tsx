import { Link } from 'react-router-dom';
import { ArrowLeft, Cloud, Database, ShieldCheck, Smartphone } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardHeader } from '@/components/ui';
import { clearSampleData } from '@/services/db/seed';

const steps = [
  { title: 'Salin konfigurasi', body: 'Salin .env.example menjadi .env lalu isi nilai Firebase Web App config dari Firebase Console.' },
  { title: 'Aktifkan layanan', body: 'Aktifkan Authentication (Email/Password) dan Cloud Firestore. Hosting opsional untuk deployment.' },
  { title: 'Terapkan aturan', body: 'Deploy firestore.rules dan firestore.indexes.json melalui Firebase CLI.' },
  { title: 'Buat admin awal', body: 'Jalankan npm run bootstrap:admin dengan service account Admin SDK, lalu hapus kredensial dari komputer.' }
];

export function SetupPage() {
  const { isLocalMode, notify } = useApp();
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link to="/login" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft className="h-4 w-4" /> Kembali ke masuk</Link>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Panduan Setup UJIAN HARIAN</h1>
          <p className="mt-1 text-sm text-slate-500">Aplikasi dapat langsung dicoba dalam mode lokal, lalu dipindah ke Firebase Spark Plan untuk penggunaan produksi.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-accent-600"><Database className="h-5 w-5" /><h2 className="font-bold">Status penyimpanan</h2></div>
            <p className="mt-2 text-sm text-slate-600">{isLocalMode ? 'Mode Lokal — data tersimpan di IndexedDB perangkat ini. Jangan dipakai untuk ujian produksi.' : 'Firebase terhubung — data tersimpan di Cloud Firestore project Anda.'}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-accent-600"><ShieldCheck className="h-5 w-5" /><h2 className="font-bold">Keamanan</h2></div>
            <p className="mt-2 text-sm text-slate-600">Peran diverifikasi dari dokumen users dan custom claims. Kunci jawaban tidak pernah dikirim ke perangkat siswa.</p>
          </Card>
        </div>

        <Card>
          <CardHeader title="Konfigurasi Firebase" description="Ikuti langkah berikut untuk mengaktifkan backend." />
          <ol className="space-y-3 p-5">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-100 text-xs font-bold text-navy-800">{index + 1}</span>
                <div><p className="text-sm font-semibold text-navy-900">{step.title}</p><p className="text-sm text-slate-600">{step.body}</p></div>
              </li>
            ))}
          </ol>
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Detail lengkap: <code className="rounded bg-slate-100 px-1">README.md</code> dan <code className="rounded bg-slate-100 px-1">docs/deployment.md</code>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-accent-600"><Smartphone className="h-5 w-5" /><h2 className="font-bold">PWA</h2></div>
            <p className="mt-2 text-sm text-slate-600">Buka aplikasi di Chrome Android, pilih menu ⋮ → Install aplikasi. Di Windows, gunakan menu Install pada address bar Chrome/Edge.</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-accent-600"><Cloud className="h-5 w-5" /><h2 className="font-bold">Media</h2></div>
            <p className="mt-2 text-sm text-slate-600">Secara default media disimpan pada URL eksternal (Drive sekolah). File kecil dapat disimpan lokal di perangkat melalui pengaturan VITE_MEDIA_MODE=local.</p>
          </Card>
        </div>

        {isLocalMode && (
          <Card className="p-5">
            <h2 className="font-bold text-navy-900">Hapus data contoh</h2>
            <p className="mt-1 text-sm text-slate-600">Menghapus akun, soal, ujian, dan data contoh lainnya dari perangkat ini. Data buatan Anda tidak dihapus.</p>
            <button className="btn-danger mt-3" onClick={() => clearSampleData().then(() => notify('Data contoh dihapus.', 'success')).catch((error: Error) => notify(error.message, 'error'))}>Hapus data contoh</button>
          </Card>
        )}
      </div>
    </div>
  );
}
