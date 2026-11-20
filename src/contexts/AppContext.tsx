import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService, type AuthUser } from '@/services/auth/service';
import { db, isLocalMode } from '@/services/db';
import type { Role, UserProfile } from '@/types';

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: string; message: string; kind: ToastKind }

interface AppContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  isLocalMode: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  notify: (message: string, kind?: ToastKind) => void;
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authService.currentUser());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refreshProfile = useCallback(async () => {
    const current = authService.currentUser();
    if (!current) {
      setProfile(null);
      return;
    }
    const found = await db.get<UserProfile>('users', current.uid);
    const fallbackRole = authService.localRole() ?? 'student';
    if (!found) {
      const now = new Date().toISOString();
      const created: UserProfile = {
        id: current.uid, uid: current.uid, name: current.displayName || current.email,
        email: current.email, role: fallbackRole, active: true,
        createdAt: now, updatedAt: now, createdBy: current.uid, updatedBy: current.uid
      };
      await db.create('users', created as unknown as Record<string, unknown>, current.uid);
      setProfile(created);
      return;
    }
    setProfile(found);
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = authService.onChange((next) => {
      setUser(next);
      setLoading(true);
      refreshProfile().finally(() => { if (mounted) setLoading(false); });
    });
    refreshProfile().finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; unsubscribe(); };
  }, [refreshProfile]);

  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    user, profile, role: profile?.role ?? null, loading, isLocalMode,
    signOut, refreshProfile, notify, toasts,
    dismissToast: (id: string) => setToasts((current) => current.filter((toast) => toast.id !== id))
  }), [user, profile, loading, signOut, refreshProfile, notify, toasts]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp harus dipakai di dalam AppProvider');
  return context;
}
