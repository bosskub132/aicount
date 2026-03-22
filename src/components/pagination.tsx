// src/components/pagination.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  perPage?: number;
  onPerPageChange?: (perPage: number) => void;
}

const perPageOptions = [25, 50, 100];

export function Pagination({ currentPage, totalPages, onPageChange, perPage, onPerPageChange }: PaginationProps) {
  if (totalPages <= 1 && !perPage) return null;

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (currentPage <= 4) return i + 1;
    if (currentPage >= totalPages - 3) return totalPages - 6 + i;
    return currentPage - 3 + i;
  });

  return (
    <div className="flex items-center justify-between">
      {perPage && onPerPageChange ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span>Rows:</span>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="rounded-[var(--radius-input)] border border-[var(--border)] bg-white px-2 py-1 text-sm cursor-pointer"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      ) : <div />}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-[var(--radius-button)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[32px] h-8 px-2 rounded-[var(--radius-button)] text-sm font-medium cursor-pointer transition-colors duration-100 ${
              page === currentPage
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-[var(--radius-button)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
