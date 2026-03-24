// src/components/report-filter-bar.tsx
"use client";

import { History, SlidersHorizontal } from "lucide-react";
import { PeriodPicker } from "@/components/period-picker";
import { Select } from "@/components/select";
import { Toggle } from "@/components/toggle";

type Scope = "monthly" | "quarterly" | "yearly";

interface AdvancedFilterDef {
  key: string;
  label: string;
  type: "toggle" | "select" | "range";
  options?: Array<{ value: string; label: string }>;
}

interface FilterConfig {
  showDepartment?: boolean;
  showComparison?: boolean;
  showAdvanced?: boolean;
  advancedFilters?: AdvancedFilterDef[];
}

interface ReportFilterBarProps {
  config: FilterConfig;
  // Period picker props
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  period: string;
  onPeriodChange: (period: string) => void;
  lockedScope?: Scope;
  allowCustomRange?: boolean;
  customFrom?: string;
  customTo?: string;
  onCustomRangeChange?: (from: string, to: string) => void;
  // Filter values
  department?: string;
  onDepartmentChange?: (dept: string) => void;
  comparison?: string;
  onComparisonChange?: (comp: string) => void;
  // Advanced state
  advancedOpen?: boolean;
  onAdvancedToggle?: () => void;
  advancedValues?: Record<string, unknown>;
  onAdvancedChange?: (key: string, value: unknown) => void;
  // Right side
  onHistoryClick?: () => void;
}

const COMPARISON_OPTIONS = [
  { value: "none", label: "No comparison" },
  { value: "prior_month", label: "vs Prior Month" },
  { value: "prior_year", label: "vs Prior Year" },
];

const DEPARTMENT_OPTIONS = [
  { value: "all", label: "All Departments" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
  { value: "admin", label: "Administration" },
];

export function ReportFilterBar({
  config,
  scope,
  onScopeChange,
  period,
  onPeriodChange,
  lockedScope,
  allowCustomRange,
  customFrom,
  customTo,
  onCustomRangeChange,
  department,
  onDepartmentChange,
  comparison,
  onComparisonChange,
  advancedOpen,
  onAdvancedToggle,
  advancedValues,
  onAdvancedChange,
  onHistoryClick,
}: ReportFilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Main filter row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Period picker */}
        <PeriodPicker
          scope={scope}
          onScopeChange={onScopeChange}
          period={period}
          onPeriodChange={onPeriodChange}
          lockedScope={lockedScope}
          allowCustomRange={allowCustomRange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomRangeChange={onCustomRangeChange}
        />

        {/* Department select */}
        {config.showDepartment && onDepartmentChange && (
          <div className="min-w-[180px]">
            <Select
              label="Department"
              options={DEPARTMENT_OPTIONS}
              value={department || "all"}
              onChange={onDepartmentChange}
            />
          </div>
        )}

        {/* Comparison select */}
        {config.showComparison && onComparisonChange && (
          <div className="min-w-[180px]">
            <Select
              label="Comparison"
              options={COMPARISON_OPTIONS}
              value={comparison || "none"}
              onChange={onComparisonChange}
            />
          </div>
        )}

        {/* Advanced filters toggle button */}
        {config.showAdvanced && onAdvancedToggle && (
          <button
            type="button"
            onClick={onAdvancedToggle}
            className={`flex items-center gap-2 rounded-[var(--radius-button)] border border-dashed px-3 py-2 text-sm transition-colors cursor-pointer ${
              advancedOpen
                ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--info-light)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Advanced
          </button>
        )}

        {/* History button — pushed right */}
        {onHistoryClick && (
          <button
            type="button"
            onClick={onHistoryClick}
            className="ml-auto flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            <History className="h-4 w-4" />
            History
          </button>
        )}
      </div>

      {/* Advanced filters expandable section */}
      {config.showAdvanced && advancedOpen && config.advancedFilters && config.advancedFilters.length > 0 && (
        <div className="flex flex-wrap items-end gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--muted)] p-4">
          {config.advancedFilters.map((filter) => {
            const currentValue = advancedValues?.[filter.key];

            if (filter.type === "toggle") {
              return (
                <Toggle
                  key={filter.key}
                  label={filter.label}
                  checked={!!currentValue}
                  onChange={(val) => onAdvancedChange?.(filter.key, val)}
                />
              );
            }

            if (filter.type === "select" && filter.options) {
              return (
                <div key={filter.key} className="min-w-[160px]">
                  <Select
                    label={filter.label}
                    options={filter.options}
                    value={(currentValue as string) || ""}
                    onChange={(val) => onAdvancedChange?.(filter.key, val)}
                  />
                </div>
              );
            }

            if (filter.type === "range") {
              const rangeVal = (currentValue as { from?: string; to?: string }) || {};
              return (
                <div key={filter.key} className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-[var(--card-foreground)]">
                    {filter.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={rangeVal.from || ""}
                      onChange={(e) =>
                        onAdvancedChange?.(filter.key, { ...rangeVal, from: e.target.value })
                      }
                      placeholder="From"
                      className="w-24 rounded-[var(--radius-button)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
                    />
                    <span className="text-sm text-[var(--muted-foreground)]">&ndash;</span>
                    <input
                      type="number"
                      value={rangeVal.to || ""}
                      onChange={(e) =>
                        onAdvancedChange?.(filter.key, { ...rangeVal, to: e.target.value })
                      }
                      placeholder="To"
                      className="w-24 rounded-[var(--radius-button)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
                    />
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}
