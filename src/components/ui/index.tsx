import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertCircle, Inbox, Loader2, X } from 'lucide-react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
};

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: ButtonProps) {
  const style = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger', ghost: 'btn-ghost' }[variant];
  return (
    <button className={`${style} ${size === 'sm' ? 'px-3 py-1.5 text-xs' : ''} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="section-title">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Input({ label, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <input className={`input ${error ? 'border-rose-400' : ''}`} {...props} />
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Textarea({ label, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <textarea className={`input min-h-24 resize-y ${error ? 'border-rose-400' : ''}`} {...props} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Select({ label, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <select className={`input ${error ? 'border-rose-400' : ''}`} {...props}>{children}</select>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-navy-800">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-accent-500" {...props} />
      {label}
    </label>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700', violet: 'bg-violet-100 text-violet-700'
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function StatCard({ label, value, icon, hint, tone = 'blue' }: {
  label: string; value: ReactNode; icon?: ReactNode; hint?: string; tone?: 'blue' | 'green' | 'amber' | 'violet';
}) {
  const tones = {
    blue: 'bg-blue-50 text-accent-600', green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600'
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-navy-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && <div className={`rounded-xl p-2.5 ${tones[tone]}`}>{icon}</div>}
      </div>
    </Card>
  );
}

export function Loading({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin text-accent-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center">
      <Inbox className="h-9 w-9 text-slate-300" />
      <p className="font-semibold text-navy-800">{title}</p>
      {description && <p className="max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">Terjadi kesalahan</p>
        <p>{message}</p>
      </div>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Coba lagi</Button>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, width = 'max-w-2xl' }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${width}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 className="section-title">{title}</h3>
          <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Tutup"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Hapus', onConfirm, onClose, loading }: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onClose: () => void; loading?: boolean;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} width="max-w-md">
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Cari…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <input className="input pl-9" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <svg className="absolute left-3 top-3 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
