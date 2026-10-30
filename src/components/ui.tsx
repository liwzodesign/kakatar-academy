import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-gray-500" role="status">
      <Loader2 className="w-5 h-5 animate-spin" /> <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error | string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
      <p>{typeof error === 'string' ? error : error.message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium underline">Réessayer</button>
      )}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 disabled:opacity-60',
  ghost: 'text-gray-700 hover:bg-gray-100',
};

export function Button({
  variant = 'primary', loading, children, className = '', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; children: ReactNode }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
        transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-brand-500
          focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-gray-200" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}
