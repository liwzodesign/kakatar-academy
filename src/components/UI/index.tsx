import React from 'react';
import { AlertCircle, CheckCircle, Inbox } from 'lucide-react';
import { initials } from '../../lib/format';

export const Spinner: React.FC<{ className?: string }> = ({ className = 'min-h-96' }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <div role="status" aria-label="Chargement" className="animate-spin rounded-full h-10 w-10 border-[3px] border-primary-100 border-t-primary-700" />
  </div>
);

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex items-start space-x-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
    <div className="flex-1 text-sm">{message}</div>
    {onRetry && (
      <button onClick={onRetry} className="text-sm font-medium underline">
        Réessayer
      </button>
    )}
  </div>
);

export const SuccessBox: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start space-x-3 bg-secondary-50 border border-secondary-200 text-secondary-700 rounded-lg p-4">
    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
    <div className="flex-1 text-sm">{message}</div>
  </div>
);

export const EmptyState: React.FC<{ title: string; text?: string; action?: React.ReactNode }> = ({
  title,
  text,
  action,
}) => (
  <div className="text-center py-14 px-6 bg-white rounded-2xl ring-1 ring-gray-100 shadow-card">
    <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4"><Inbox className="w-7 h-7 text-primary-400" /></div>
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    {text && <p className="text-gray-500 mt-1">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Avatar: React.FC<{ name: string; src?: string; size?: string }> = ({ name, src, size = 'w-10 h-10' }) =>
  src && !src.includes('ui-avatars.com') ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover`} />
  ) : (
    <div className={`${size} bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center flex-shrink-0`}>
      <span className="text-sm font-bold text-white">{initials(name)}</span>
    </div>
  );

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6 ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  color?: string;
  hint?: string;
}> = ({ label, value, icon: Icon, color = 'bg-primary-100 text-primary-600', hint }) => (
  <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-5 sm:p-6">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 mt-1 tabular-nums">{value}</p>
        {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

/** Histogramme minimal en barres (sans dépendance). */
export const BarChart: React.FC<{ data: { label: string; value: number }[]; format?: (v: number) => string }> = ({
  data,
  format = (v) => String(v),
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => !d.value)) {
    return (
      <div className="h-40 flex flex-col items-center justify-center rounded-xl bg-gray-50 text-center">
        <p className="text-sm font-semibold text-gray-600">Pas encore de données sur la période</p>
        <p className="text-xs text-gray-400 mt-1">Le graphique se remplira au fil de l'activité.</p>
      </div>
    );
  }
  return (
    <div className="flex items-end h-40 gap-1">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full group relative">
          <div
            className={d.value
              ? 'w-full bg-gradient-to-t from-primary-700 to-primary-400 rounded-t-md hover:from-secondary-600 hover:to-secondary-400 transition-colors min-h-[4px]'
              : 'w-full h-px bg-gray-200'}
            style={d.value ? { height: `${(d.value / max) * 100}%` } : undefined}
          />
          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
            {d.label} : {format(d.value)}
          </div>
        </div>
      ))}
    </div>
  );
};

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm" onClick={onClose} />
    <div role="dialog" aria-modal="true" aria-label={title} className="relative bg-white rounded-3xl shadow-lift max-w-lg w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold text-gray-900">{title}</h2>
        <button onClick={onClose} aria-label="Fermer" className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-2xl leading-none">
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const inputClass =
  'w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100';
export const buttonPrimary =
  'bg-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-primary-800 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed';
export const buttonSecondary =
  'bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50';

/** Squelette de carte de cours (chargement du catalogue). */
export const CourseCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden" aria-hidden>
    <div className="skeleton h-44 rounded-none" />
    <div className="p-5 space-y-3">
      <div className="skeleton h-3 w-1/3" />
      <div className="skeleton h-5 w-5/6" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-2/3" />
    </div>
  </div>
);
