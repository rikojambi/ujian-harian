import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export function ToastHost() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-20 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 sm:bottom-4" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? AlertCircle : Info;
        const color = toast.kind === 'success' ? 'text-emerald-600' : toast.kind === 'error' ? 'text-rose-600' : 'text-accent-600';
        return (
          <div key={toast.id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
            <span className="flex-1 text-sm text-navy-800">{toast.message}</span>
            <button onClick={() => dismissToast(toast.id)} className="text-slate-400 hover:text-slate-700" aria-label="Tutup notifikasi"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
