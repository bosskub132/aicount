// src/components/period-picker.tsx
"use client";

import { useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

type Scope = "monthly" | "quarterly" | "yearly";

interface PeriodPickerProps {
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  period: string; // "2026-03", "2026-Q1", "2026"
  onPeriodChange: (period: string) => void;
  allowCustomRange?: boolean;
  customFrom?: string;
  customTo?: string;
  onCustomRangeChange?: (from: string, to: string) => void;
  lockedScope?: Scope;
}

const SCOPE_OPTIONS: Array<{ value: Scope; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parsePeriod(scope: Scope, period: string): { year: number; month?: number; quarter?: number } {
  if (scope === "monthly") {
    const [yearStr, monthStr] = period.split("-");
    return { year: parseInt(yearStr, 10), month: parseInt(monthStr, 10) };
  }
  if (scope === "quarterly") {
    const match = period.match(/^(\d{4})-Q(\d)$/);
    if (match) {
      return { year: parseInt(match[1], 10), quarter: parseInt(match[2], 10) };
    }
  }
  return { year: parseInt(period, 10) };
}

function formatPeriodDisplay(scope: Scope, period: string): string {
  const parsed = parsePeriod(scope, period);
  if (scope === "monthly" && parsed.month !== undefined) {
    return `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`;
  }
  if (scope === "quarterly" && parsed.quarter !== undefined) {
    return `Q${parsed.quarter} ${parsed.year}`;
  }
  return `${parsed.year}`;
}

function getDateRange(scope: Scope, period: string): string {
  const parsed = parsePeriod(scope, period);
  const year = parsed.year;

  if (scope === "monthly" && parsed.month !== undefined) {
    const month = parsed.month;
    const lastDay = new Date(year, month, 0).getDate();
    return `${month} ${MONTH_NAMES[month - 1].slice(0, 3)} \u2014 ${lastDay} ${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`;
  }
  if (scope === "quarterly" && parsed.quarter !== undefined) {
    const q = parsed.quarter;
    const startMonth = (q - 1) * 3;
    const endMonth = startMonth + 2;
    const lastDay = new Date(year, endMonth + 1, 0).getDate();
    return `1 ${MONTH_NAMES[startMonth].slice(0, 3)} \u2014 ${lastDay} ${MONTH_NAMES[endMonth].slice(0, 3)} ${year}`;
  }
  return `1 Jan \u2014 31 Dec ${year}`;
}

function navigatePeriod(scope: Scope, period: string, direction: -1 | 1): string {
  const parsed = parsePeriod(scope, period);

  if (scope === "monthly" && parsed.month !== undefined) {
    let newMonth = parsed.month + direction;
    let newYear = parsed.year;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    return `${newYear}-${String(newMonth).padStart(2, "0")}`;
  }
  if (scope === "quarterly" && parsed.quarter !== undefined) {
    let newQ = parsed.quarter + direction;
    let newYear = parsed.year;
    if (newQ < 1) { newQ = 4; newYear -= 1; }
    if (newQ > 4) { newQ = 1; newYear += 1; }
    return `${newYear}-Q${newQ}`;
  }
  return `${parsed.year + direction}`;
}

export function PeriodPicker({
  scope,
  onScopeChange,
  period,
  onPeriodChange,
  allowCustomRange,
  customFrom,
  customTo,
  onCustomRangeChange,
  lockedScope,
}: PeriodPickerProps) {
  const activeScope = lockedScope ?? scope;
  const isCustomMode = allowCustomRange && customFrom !== undefined && customTo !== undefined;

  const displayText = useMemo(() => formatPeriodDisplay(activeScope, period), [activeScope, period]);
  const hintText = useMemo(() => getDateRange(activeScope, period), [activeScope, period]);

  const handlePrev = useCallback(() => {
    onPeriodChange(navigatePeriod(activeScope, period, -1));
  }, [activeScope, period, onPeriodChange]);

  const handleNext = useCallback(() => {
    onPeriodChange(navigatePeriod(activeScope, period, 1));
  }, [activeScope, period, onPeriodChange]);

  const handleToggleCustom = useCallback(() => {
    if (!onCustomRangeChange) return;
    if (isCustomMode) {
      onCustomRangeChange("", "");
    } else {
      onCustomRangeChange(customFrom || "", customTo || "");
    }
  }, [isCustomMode, customFrom, customTo, onCustomRangeChange]);

  return (
    <div className="flex flex-col gap-2">
      {/* Scope toggle — hidden when scope is locked */}
      {!lockedScope && (
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onScopeChange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeScope === opt.value
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Custom range toggle */}
      {allowCustomRange && (
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5 self-start">
          <button
            type="button"
            onClick={handleToggleCustom}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              !isCustomMode
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Period
          </button>
          <button
            type="button"
            onClick={handleToggleCustom}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              isCustomMode
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Custom Range
          </button>
        </div>
      )}

      {/* Period navigator or custom date inputs */}
      {isCustomMode ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomRangeChange?.(e.target.value, customTo || "")}
            className="rounded-[var(--radius-button)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
          />
          <span className="text-sm text-[var(--muted-foreground)]">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomRangeChange?.(customFrom || "", e.target.value)}
            className="rounded-[var(--radius-button)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-button)] border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--border)] bg-white px-4 py-2 min-w-[180px] justify-center">
            <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">{displayText}</span>
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-button)] border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Date range hint */}
      {!isCustomMode && (
        <p className="text-xs text-[var(--muted-foreground)]">{hintText}</p>
      )}
    </div>
  );
}
