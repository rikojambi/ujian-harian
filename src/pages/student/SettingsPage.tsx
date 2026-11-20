import { useApp } from '@/contexts/AppContext';
import { Badge, Button, Card, CardHeader } from '@/components/ui';
import { isLocalMode } from '@/services/db';
import { initials } from '@/utils/format';

export default function StudentSettingsPage() {
  const { profile, signOut } = useApp();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader title="Profil siswa" />
        <div className="space-y-3 p-5 text-sm">
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-navy-100 font-bold text-navy-800">{initials(profile?.name ?? 'Siswa')}</div><div><p className="font-semibold">{profile?.name}</p><p className="text-slate-500">{profile?.email}</p></div></div>
          <p><span className="text-slate-500">Status akun:</span> <Badge tone={profile?.active ? 'green' : 'red'}>{profile?.active ? 'Aktif' : 'Nonaktif'}</Badge></p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Aplikasi" />
        <div className="space-y-3 p-5 text-sm text-slate-600">
          <p><span className="text-slate-500">Mode:</span> <Badge tone={isLocalMode ? 'violet' : 'green'}>{isLocalMode ? 'Lokal' : 'Firebase'}</Badge></p>
          <p>Jawaban disimpan otomatis. Jika koneksi terputus, jawaban akan disinkronkan saat jaringan kembali.</p>
          <p>Nilai dan pembahasan hanya muncul setelah guru mempublikasikan hasil.</p>
          <Button variant="secondary" onClick={() => void signOut()}>Keluar dari akun</Button>
        </div>
      </Card>
    </div>
  );
}
