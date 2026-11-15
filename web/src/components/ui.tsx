import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'icon';
};
export function Button({ variant = 'secondary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'icon' && 'h-9 w-9',
        variant === 'primary' && 'bg-indigo-600 text-accent-fg shadow-sm hover:bg-indigo-500',
        variant === 'secondary' && 'bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:hover:bg-zinc-800',
        variant === 'ghost' && 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        variant === 'danger' && 'text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40',
        className,
      )}
    />
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={cx(
        'h-10 w-full rounded-lg bg-white px-3 text-sm text-zinc-900 ring-1 ring-zinc-200 outline-none transition placeholder:text-zinc-400',
        'focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800',
        className,
      )}
    />
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
        checked ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700',
      )}
    >
      <span className={cx('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
    </button>
  );
}

export function Segmented<T extends string | number>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/70">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-7 cursor-pointer rounded-md px-3 text-[13px] font-medium transition',
            o.value === value ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-xl bg-white ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800', className)}>{children}</div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Thumb({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const style = { width: size, height: size };
  if (src && !broken)
    return <img src={src} alt="" style={style} onError={() => setBroken(true)} className="shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800" />;
  return (
    <div style={style} className="grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 text-[13px] font-semibold text-indigo-700 dark:from-indigo-950 dark:to-violet-950 dark:text-indigo-300">
      {initials || '?'}
    </div>
  );
}

export function Dialog({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl ring-1 ring-zinc-200 sm:rounded-2xl dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={18} /></Button>
        </div>
        <div className="px-5 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 pb-5 pt-2">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- toasts ----------
type ToastMsg = { id: number; text: string; kind: 'ok' | 'error' };
export function toast(text: string, kind: 'ok' | 'error' = 'ok') {
  window.dispatchEvent(new CustomEvent('mw-toast', { detail: { text, kind } }));
}
export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { text, kind } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, text, kind }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3500);
    };
    window.addEventListener('mw-toast', on);
    return () => window.removeEventListener('mw-toast', on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((t) => (
        <div key={t.id} className={cx('rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg', t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900')}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
