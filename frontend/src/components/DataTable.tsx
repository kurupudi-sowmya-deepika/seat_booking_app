import React from 'react';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = 'No records found',
  emptyDescription,
}: DataTableProps<T>) {
  if (loading) return <LoadingState />;
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#007bc0] text-white">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-[13px] font-bold uppercase tracking-wide ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-gray-100 hover:bg-blue-50/40">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3.5 text-[15px] text-gray-800 ${col.className || ''}`}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
