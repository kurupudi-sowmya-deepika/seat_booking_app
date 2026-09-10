import React from 'react';

type StatusKind =
  | 'AVAILABLE'
  | 'BOOKED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'SUCCESS'
  | 'ERROR'
  | 'WARNING'
  | 'UNAVAILABLE';

const STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  BOOKED: 'bg-slate-200 text-slate-700 border-slate-300',
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-[#005691] border-blue-200',
  COMPLETED: 'bg-gray-100 text-gray-700 border-gray-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  SUCCESS: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ERROR: 'bg-red-50 text-red-700 border-red-200',
  WARNING: 'bg-amber-50 text-amber-800 border-amber-200',
  UNAVAILABLE: 'bg-slate-200 text-slate-700 border-slate-300',
};

export const StatusBadge: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const key = (status || '').toUpperCase() as StatusKind;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${STYLES[key] || STYLES.PENDING}`}
    >
      {label || status}
    </span>
  );
};

export default StatusBadge;
