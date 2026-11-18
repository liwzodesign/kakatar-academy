/** Composants d'interface partagés (système de design Kakatar Academy). */
import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';

type Tone = 'primary' | 'secondary' | 'sun' | 'rose' | 'sky' | 'gray' | 'danger';

const TONES: Record<Tone, string> = {
  primary: 'bg-primary-50 text-primary-700 ring-primary-200/70',
  secondary: 'bg-secondary-50 text-secondary-700 ring-secondary-200/70',
  sun: 'bg-sun-50 text-sun-700 ring-sun-100',
  rose: 'bg-rose-100 text-rose-600 ring-rose-100',
  sky: 'bg-sky-100 text-sky-600 ring-sky-100',
  gray: 'bg-gray-100 text-gray-600 ring-gray-200/70',
  danger: 'bg-red-50 text-red-700 ring-red-100',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; icon?: React.ElementType; className?: string }> = ({
  tone = 'gray', children, icon: Icon, className = '',
}) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 whitespace-nowrap ${TONES[tone]} ${className}`}>
    {Icon && <Icon className="w-3.5 h-3.5" />}
    {children}
  </span>
);

/** Contrôle segmenté (onglets). */
export function Tabs<T extends string>({ value, onChange, items, className = '' }: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; icon?: React.ElementType; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={`inline-flex max-w-full overflow-x-auto p-1 bg-gray-100 rounded-xl gap-1 ${className}`}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              active ? 'bg-white text-primary-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {it.icon && <it.icon className="w-4 h-4" />}
            {it.label}
            {it.count !== undefined && (
              <span className={`text-xs px-1.5 rounded-full ${active ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const Section: React.FC<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}> = ({ title, description, actions, children, className = '', padded = true }) => (
  <section className={`bg-white rounded-2xl shadow-card ring-1 ring-gray-100 ${className}`}>
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6">
        <div>
          {title && <h2 className="text-lg font-bold text-gray-900">{title}</h2>}
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
        {actions}
      </header>
    )}
    <div className={padded ? 'p-5 sm:p-6' : 'pt-4'}>{children}</div>
  </section>
);

export const Field: React.FC<{ label: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }> = ({
  label, hint, required, children, className = '',
}) => (
  <label className={`block ${className}`}>
    <span className="block text-sm font-semibold text-gray-800 mb-1.5">
      {label}
      {required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
    {hint && <span className="block text-xs text-gray-500 mt-1.5">{hint}</span>}
  </label>
);

export const ProgressBar: React.FC<{ value: number; tone?: 'primary' | 'secondary'; className?: string; label?: string }> = ({
  value, tone = 'primary', className = '', label,
}) => (
  <div
    role="progressbar"
    aria-valuenow={Math.round(value)}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label={label}
    className={`w-full h-2 rounded-full bg-gray-100 overflow-hidden ${className}`}
  >
    <div
      className={`h-full rounded-full transition-all duration-500 ${tone === 'secondary' ? 'bg-secondary-500' : 'bg-gradient-to-r from-primary-600 to-secondary-500'}`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

/** Anneau de progression (lecteur de cours, cartes). */
export const ProgressRing: React.FC<{ value: number; size?: number; stroke?: number; light?: boolean }> = ({
  value, size = 44, stroke = 4, light = false,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={light ? 'stroke-white/20' : 'stroke-gray-100'} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-secondary-500 transition-all duration-500"
          strokeDasharray={c} strokeDashoffset={c - (Math.min(100, value) / 100) * c} />
      </svg>
      <span className={`absolute text-[11px] font-bold ${light ? 'text-white' : 'text-gray-800'}`}>{Math.round(value)}%</span>
    </span>
  );
};

/** Zone de dépôt de fichier (remplace l'input natif, en français, avec aperçu image). */
export const FileDrop: React.FC<{
  accept?: string;
  file: File | null;
  onChange: (f: File | null) => void;
  label?: string;
  hint?: string;
  currentUrl?: string;
  image?: boolean;
}> = ({ accept, file, onChange, label = 'Choisir un fichier', hint, currentUrl, image = false }) => {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !image) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, image]);

  const shown = preview || (image ? currentUrl : undefined);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) onChange(e.dataTransfer.files[0]); }}
      className={`relative flex items-center gap-4 p-4 rounded-xl border-2 border-dashed transition-colors ${drag ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'}`}
    >
      {shown ? (
        <img src={shown} alt="" className="w-16 h-16 rounded-xl object-cover ring-1 ring-gray-200" />
      ) : (
        <span className="w-16 h-16 rounded-xl bg-white ring-1 ring-gray-200 flex items-center justify-center text-gray-400">
          {image ? <ImagePlus className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
        </span>
      )}
      <div className="flex-1 min-w-0 text-sm">
        {file ? (
          <p className="font-semibold text-gray-900 truncate">{file.name}</p>
        ) : (
          <p className="text-gray-700">
            <button type="button" onClick={() => input.current?.click()} className="font-semibold text-primary-700 hover:underline">{label}</button>
            <span className="text-gray-500"> ou glissez-le ici</span>
          </p>
        )}
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {file && (
        <button type="button" onClick={() => onChange(null)} aria-label="Retirer le fichier" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      )}
      <input ref={input} type="file" accept={accept} className="sr-only" onChange={(e) => onChange(e.target.files?.[0] || null)} />
    </div>
  );
};

/** Tableau responsive : en-tête stylé, lignes aérées. */
export const Table: React.FC<{ head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode }> = ({ head, children, empty }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
          {head.map((h, i) => <th key={i} className="px-5 py-3 font-semibold whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
    {empty}
  </div>
);

export const Td: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`px-5 py-3.5 align-middle ${className}`}>{children}</td>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'default' | 'danger' }> = ({
  label, tone = 'default', children, className = '', ...rest
}) => (
  <button
    {...rest}
    aria-label={label}
    title={label}
    className={`p-2 rounded-lg transition-colors ${tone === 'danger' ? 'text-gray-400 hover:bg-red-50 hover:text-red-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'} ${className}`}
  >
    {children}
  </button>
);
