import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpenCheck, ShieldCheck } from 'lucide-react';
import { authService } from '@/services/auth/service';
import { seedSampleData } from '@/services/db/seed';
import { useApp } from '@/contexts/AppContext';
import { Button, Card, Input } from '@/components/ui';
import { loginSchema, firstError } from '@/utils/validation';

export function LoginPage() {
  const { user, profile, isLocalMode, notify } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<Array<{ role: string; email: string; password: string }>>([]);

  useEffect(() => {
    if (user && profile) navigate(profile.role === 'admin' ? '/admin' : profile.role === 'teacher' ? '/guru' : '/siswa', { replace: true });
  }, [user, profile, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) { setError(firstError(parsed.error)); return; }
    setError('');
    setLoading(true);
    try {
      await authService.signIn(parsed.data.email, parsed.data.password);
      authService.notifyLocalAuthChange();
      notify('Berhasil masuk.', 'success');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal masuk.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedSampleData();
      setDemoAccounts(result.accounts);
      notify('Data contoh berhasil dimuat.', 'success');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Gagal memuat data contoh.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><BookOpenCheck className="h-8 w-8" /></div>
          <h1 className="text-2xl font-bold tracking-wide">UJIAN HARIAN</h1>
          <p className="mt-1 text-sm text-blue-100">Sistem ujian digital untuk SMK</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <h2 className="section-title">Masuk ke akun</h2>
              <p className="mt-1 text-sm text-slate-500">Gunakan akun yang telah dibuat administrator.</p>
            </div>
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
            <Input label="Email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@sekolah.sch.id" required />
            <Input label="Kata sandi" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required />
            <Button className="w-full" type="submit" loading={loading}>Masuk</Button>
          </form>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Akses sesuai peran</span>
            <Link to="/setup" className="link font-semibold">Panduan setup</Link>
          </div>
        </Card>

        {isLocalMode && (
          <Card className="mt-4 border-dashed p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Mode lokal (development)</p>
            <p className="mt-1 text-sm text-slate-600">Firebase belum dikonfigurasi. Muat data contoh untuk mencoba seluruh alur aplikasi, atau isi <code className="rounded bg-slate-100 px-1">.env</code> untuk memakai Firebase.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={handleSeed} loading={seeding}>Muat data contoh</Button>
            {demoAccounts.length > 0 && (
              <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
                {demoAccounts.map((account) => (
                  <div key={account.email} className="flex flex-wrap justify-between gap-1">
                    <span className="font-semibold capitalize">{account.role}</span>
                    <button className="link" onClick={() => { setEmail(account.email); setPassword(account.password); }}>{account.email} / {account.password}</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
