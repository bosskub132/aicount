// src/components/data-table.tsx
"use client";

import { Fragment, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortable?: boolean;
  selectable?: boolean;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  onSelect?: (selected: T[]) => void;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  emptyMessage?: string;
  footer?: React.ReactNode;
  keyField?: string;
  /** Render function for expanded row content */
  expandedRow?: (row: T) => React.ReactNode;
  /** Set of row IDs that are currently expanded */
  expandedRowIds?: Set<string>;
  /** Callback when a row's expand state is toggled */
  onToggleExpand?: (rowId: string) => void;
  /** Extract a unique ID from a row (defaults to row.id) */
  getRowId?: (row: T) => string;
}

export function DataTable<T extends Record<string, unknown>>(props: DataTableProps<T>) {
  const {
    columns,
    data: rawData,
    sortable,
    selectable,
    onSort,
    onSelect,
    onRowClick,
    onRowDoubleClick,
    emptyMessage = "No data",
    footer,
    keyField = "id",
    expandedRow,
    expandedRowIds,
    getRowId,
  } = props;
  const data = Array.isArray(rawData) ? rawData : [];
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const resolveRowId = (row: T): string =>
    getRowId ? getRowId(row) : String(row[keyField]);

  const totalColSpan = columns.length + (selectable ? 1 : 0);

  const handleSort = (key: string) => {
    if (!sortable) return;
    const newDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(newDir);
    onSort?.(key, newDir);
  };

  const handleSelectAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set());
      onSelect?.([]);
    } else {
      const all = new Set(data.map((row) => String(row[keyField])));
      setSelected(all);
      onSelect?.(data);
    }
  };

  const handleSelectRow = (row: T) => {
    const key = String(row[keyField]);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    onSelect?.(data.filter((r) => next.has(String(r[keyField]))));
  };

  const alignClass = (align?: string) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={data.length > 0 && selected.size === data.length}
                  onChange={handleSelectAll}
                  className="cursor-pointer"
                  aria-label="Select all"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] ${alignClass(col.align)} ${
                  col.sortable !== false && sortable ? "cursor-pointer select-none hover:text-[var(--foreground)]" : ""
                }`}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => col.sortable !== false && sortable && handleSort(col.key)}
                aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable !== false && sortable && (
                    sortKey === col.key ? (
                      sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
                    )
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="px-4 py-12 text-center text-[var(--muted-foreground)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => {
              const rowId = resolveRowId(row);
              const isExpanded = expandedRowIds?.has(rowId) ?? false;
              return (
                <Fragment key={rowId || i}>
                  <tr
                    onClick={() => onRowClick?.(row)}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                    className={`border-b border-[var(--muted)] last:border-0 transition-colors duration-100 ${
                      onRowClick || onRowDoubleClick ? "cursor-pointer hover:bg-[var(--primary-light)]" : "hover:bg-[var(--muted)]/50"
                    } ${
                      selected.has(String(row[keyField])) ? "bg-[var(--primary-light)]" : ""
                    }`}
                  >
                    {selectable && (
                      <td className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(String(row[keyField]))}
                          onChange={() => handleSelectRow(row)}
                          className="cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${alignClass(col.align)} ${
                          col.align === "right" ? "tabular-nums" : ""
                        }`}
                      >
                        {col.render ? col.render(row) : String(row[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && expandedRow && (
                    <tr className="bg-[var(--surface-secondary)]">
                      <td colSpan={totalColSpan} className="px-4 py-3">
                        {expandedRow(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-[var(--border)] bg-[var(--muted)] font-medium">
              {footer}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
