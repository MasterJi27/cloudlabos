"use client";

import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function Table<T>({ columns, data, keyExtractor, onRowClick, emptyMessage = "No data" }: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[13px] text-[var(--text-tertiary)]">{emptyMessage}</div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.06)]">
            {columns.map((col) => (
              <th key={col.key} className={`text-left text-[12px] font-medium text-[var(--text-tertiary)] tracking-micro pb-3 px-4 ${col.className || ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={`${onRowClick ? "cursor-pointer" : ""} hover:bg-[var(--surface-2)] transition-colors`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`py-3 px-4 text-[13px] text-[var(--text-primary)] ${col.className || ""}`}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
