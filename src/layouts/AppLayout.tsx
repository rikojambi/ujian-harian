import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, BookOpen, CalendarDays, ClipboardList, FileBarChart, FileText, GraduationCap,
  Home, Library, LogOut, Menu, Settings, Target, Upload, Users, WifiOff, X
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Badge, Button } from '@/components/ui';
import { initials } from '@/utils/format';
import type { Role } from '@/types';

type IconType = ComponentType<{ className?: string }>;
export interface NavItem { to: string; label: string; icon: IconType }

const teacherNav: NavItem[] = [
  { to: '/guru', label: 'Beranda', icon: Home },
  { to: '/guru/bank-soal', label: 'Bank Soal', icon: Library },
  { to: '/guru/import', label: 'Impor Soal', icon: Upload },
  { to: '/guru/tp', label: 'Tujuan Pembelajaran', icon: Target },
  { to: '/guru/mata-pelajaran', label: 'Mata Pelajaran', icon: BookOpen },
  { to: '/guru/kelas', label: 'Kelas dan Siswa', icon: Users },
  { to: '/guru/buat-ujian', label: 'Buat Ujian', icon: ClipboardList },
  { to: '/guru/ujian', label: 'Daftar Ujian', icon: CalendarDays },
  { to: '/guru/hasil', label: 'Hasil Ujian', icon: FileText },
  { to: '/guru/analisis-butir', label: 'Analisis Butir Soal', icon: BarChart3 },
  { to: '/guru/analisis-siswa', label: 'Analisis Siswa', icon: GraduationCap },
  { to: '/guru/laporan', label: 'Laporan', icon: FileBarChart },
  { to: '/guru/pengaturan', label: 'Pengaturan', icon: Settings }
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Beranda', icon: Home },
  { to: '/admin/pengguna', label: 'Kelola Akun', icon: Users },
  { to: '/admin/kelas', label: 'Kelas', icon: GraduationCap },
  { to: '/admin/mata-pelajaran', label: 'Mata Pelajaran', icon: BookOpen },
  { to: '/admin/tahun-ajaran', label: 'Tahun Ajaran', icon: CalendarDays },
  { to: '/admin/ujian', label: 'Seluruh Ujian', icon: ClipboardList },
  { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings }
];

const studentNav: NavItem[] = [
  { to: '/siswa', label: 'Beranda', icon: Home },
  { to: '/siswa/ujian', label: 'Ujian Saya', icon: ClipboardList },
  { to: '/siswa/hasil', label: 'Hasil', icon: FileText },
  { to: '/siswa/pengaturan', label: 'Pengaturan', icon: Settings }
];

export function navForRole(role: Role | null): NavItem[] {
  if (role === 'admin') return adminNav;
  if (role === 'teacher') return teacherNav;
  return studentNav;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function AppLayout() {
  const { profile, role, isLocalMode, signOut } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const online = useOnline();
  const items = navForRole(role);
  const primary = items.slice(0, 4);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-navy-900 text-white md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500 font-bold">UH</div>
          <div>
            <p className="text-sm font-bold tracking-wide">UJIAN HARIAN</p>
            <p className="text-[11px] text-blue-200">Platform ujian digital SMK</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/guru' || to === '/admin' || to === '/siswa'}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? 'bg-white/15 font-semibold text-white' : 'text-blue-100/80 hover:bg-white/10'}`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" /> <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-blue-100/80 hover:bg-white/10">
            <LogOut className="h-4.5 w-4.5" /> Keluar
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-navy-800 hover:bg-slate-100 md:hidden" onClick={() => setMenuOpen(true)} aria-label="Buka menu"><Menu className="h-5 w-5" /></button>
            <div className="font-bold tracking-wide text-navy-900 md:hidden">UJIAN HARIAN</div>
          </div>
          <div className="flex items-center gap-2">
            {!online && <Badge tone="amber"><span className="flex items-center gap-1"><WifiOff className="h-3 w-3" /> Offline</span></Badge>}
            {isLocalMode && <Badge tone="violet">Mode Lokal</Badge>}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 py-1 pl-1 pr-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-navy-100 text-xs font-bold text-navy-800">{initials(profile?.name ?? 'User')}</div>
              <div className="hidden text-left sm:block">
                <p className="max-w-40 truncate text-xs font-semibold text-navy-900">{profile?.name}</p>
                <p className="text-[10px] capitalize text-slate-500">{role === 'teacher' ? 'Guru' : role}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {primary.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/guru' || to === '/admin' || to === '/siswa'}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold ${isActive ? 'text-accent-600' : 'text-slate-500'}`}>
            <Icon className="h-5 w-5" /><span className="truncate px-1">{label.split(' ')[0]}</span>
          </NavLink>
        ))}
        <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-slate-500">
          <Menu className="h-5 w-5" /><span className="truncate px-1">Menu</span>
        </button>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex bg-navy-950/50 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="ml-auto flex h-full w-[82%] max-w-sm flex-col bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <span className="font-bold text-navy-900">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/guru' || to === '/admin' || to === '/siswa'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${isActive ? 'bg-navy-50 font-semibold text-accent-600' : 'text-navy-700 hover:bg-slate-50'}`}>
                  <Icon className="h-5 w-5" /> {label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-slate-100 p-3"><Button variant="secondary" className="w-full" onClick={handleLogout}><LogOut className="h-4 w-4" /> Keluar</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
