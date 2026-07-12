import React from 'react';
import { Lock, RefreshCw, X } from 'lucide-react';

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}> = ({ title, subtitle, action, onRefresh, refreshing }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{title}</h1>
      {subtitle && <p className="text-xs text-neutral-400 mt-1">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-2">
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-xs px-3 py-2 rounded-lg text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      )}
      {action}
    </div>
  </div>
);

const STATUS_STYLES: Record<string, string> = {
  Active: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40',
  'On Trip': 'bg-blue-950/60 text-blue-400 border border-blue-800/40',
  Idle: 'bg-neutral-800 text-neutral-300 border border-neutral-700/40',
  'In Shop': 'bg-amber-950/60 text-amber-400 border border-amber-800/40',
  Retired: 'bg-red-950/60 text-red-400 border border-red-800/40',
  Assigned: 'bg-neutral-800 text-neutral-300 border border-neutral-700/40',
  'In Transit': 'bg-blue-950/60 text-blue-400 border border-blue-800/40',
  Delayed: 'bg-amber-950/60 text-amber-400 border border-amber-800/40',
  Completed: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40',
  Cancelled: 'bg-red-950/60 text-red-400 border border-red-800/40',
  Excellent: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40',
  Good: 'bg-blue-950/60 text-blue-400 border border-blue-800/40',
  Warning: 'bg-amber-950/60 text-amber-400 border border-amber-800/40',
};

export const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className = '' }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[status] || 'bg-neutral-800 text-neutral-400'} ${className}`}>
    {status}
  </span>
);

export const ReadOnlyBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 px-3 py-2 rounded-lg">
    <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
    {message}
  </div>
);

export const EmptyState: React.FC<{ message: string; icon?: React.ReactNode }> = ({ message, icon }) => (
  <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
    {icon && <div className="mb-3 opacity-50">{icon}</div>}
    <p className="text-xs">{message}</p>
  </div>
);

export const ErrorBanner: React.FC<{ title: string; message: string; icon?: React.ReactNode }> = ({ title, message, icon }) => (
  <div className="p-6 bg-red-950/40 border border-red-800 rounded-2xl flex items-center gap-3 text-red-200">
    {icon}
    <div>
      <h3 className="font-bold text-neutral-100">{title}</h3>
      <p className="text-xs text-red-300 mt-1">{message}</p>
    </div>
  </div>
);

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ title, onClose, children, maxWidth = 'max-w-lg' }) => (
  <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
    <div className={`glass w-full ${maxWidth} rounded-2xl border border-neutral-800 p-6 max-h-[90vh] overflow-y-auto`}>
      <div className="flex justify-between items-start pb-4 border-b border-neutral-800 mb-4">
        <h2 className="text-lg font-bold text-neutral-100">{title}</h2>
        <button
          onClick={onClose}
          className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const KpiCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ label, value, icon, footer }) => (
  <div className="glass rounded-xl p-4 border border-neutral-800 relative overflow-hidden card-transition hover:border-neutral-700">
    <div className="absolute right-3 top-3 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
      {icon}
    </div>
    <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">{label}</span>
    <span className="text-2xl font-extrabold text-neutral-100 mt-1 block">{value}</span>
    {footer && <div className="mt-3">{footer}</div>}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 6 }) => (
  <div className="animate-pulse space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="h-4 bg-neutral-800 rounded flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const inputClass =
  'w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition';

export const btnPrimaryClass =
  'w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg py-2.5 transition text-xs shadow-lg shadow-brand-500/15 disabled:opacity-50 disabled:cursor-not-allowed';
