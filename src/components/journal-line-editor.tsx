"use client";

import { useCallback, useMemo } from "react";
import { Trash2, Plus, Check } from "lucide-react";
import { AccountSelect } from "@/components/account-select";
import { CurrencyInput } from "@/components/currency-input";
import { Select } from "@/components/select";
import { formatCurrency } from "@/lib/utils/format";

export interface JournalLine {
  id: string;
  accountCode: string;
  deptCode: string;
  debit: number | undefined;
  credit: number | undefined;
  description: string;
}

interface JournalLineEditorProps {
  lines: JournalLine[];
  onChange: (lines: JournalLine[]) => void;
  accounts: Array<{
    accountCode: string;
    accountName: string;
    category: string;
  }>;
  departments?: Array<{ deptCode: string; deptName: string }>;
  disabled?: boolean;
}

function generateId(): string {
  return `jl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyLine(): JournalLine {
  return {
    id: generateId(),
    accountCode: "",
    deptCode: "",
    debit: undefined,
    credit: undefined,
    description: "",
  };
}

export function JournalLineEditor({
  lines,
  onChange,
  accounts,
  departments,
  disabled = false,
}: JournalLineEditorProps) {
  const deptOptions = useMemo(
    () =>
      departments?.map((d) => ({
        label: `${d.deptCode} - ${d.deptName}`,
        value: d.deptCode,
      })) ?? [],
    [departments],
  );

  const totalDebit = useMemo(
    () => lines.reduce((sum, l) => sum + (l.debit ?? 0), 0),
    [lines],
  );

  const totalCredit = useMemo(
    () => lines.reduce((sum, l) => sum + (l.credit ?? 0), 0),
    [lines],
  );

  const difference = Math.abs(
    Math.round((totalDebit - totalCredit) * 100) / 100,
  );
  const isBalanced = difference === 0;

  const updateLine = useCallback(
    (id: string, patch: Partial<JournalLine>) => {
      onChange(
        lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
      );
    },
    [lines, onChange],
  );

  const addRow = useCallback(() => {
    onChange([...lines, createEmptyLine()]);
  }, [lines, onChange]);

  const deleteRow = useCallback(
    (id: string) => {
      if (lines.length <= 2) return;
      onChange(lines.filter((line) => line.id !== id));
    },
    [lines, onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface-raised)] text-[var(--muted-foreground)]">
              <th className="text-left px-3 py-2 font-medium min-w-[200px]">
                Account
              </th>
              {deptOptions.length > 0 && (
                <th className="text-left px-3 py-2 font-medium min-w-[150px]">
                  Department
                </th>
              )}
              <th className="text-right px-3 py-2 font-medium min-w-[140px]">
                Debit
              </th>
              <th className="text-right px-3 py-2 font-medium min-w-[140px]">
                Credit
              </th>
              <th className="text-left px-3 py-2 font-medium min-w-[160px]">
                Description
              </th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.id}
                className="border-t border-[var(--border)] hover:bg-[var(--muted)]/30 transition-colors"
              >
                {/* Account */}
                <td className="px-3 py-2">
                  <AccountSelect
                    value={line.accountCode || undefined}
                    onChange={(code) =>
                      updateLine(line.id, { accountCode: code })
                    }
                    accounts={accounts}
                    disabled={disabled}
                    placeholder="Select account..."
                  />
                </td>

                {/* Department */}
                {deptOptions.length > 0 && (
                  <td className="px-3 py-2">
                    <Select
                      value={line.deptCode || undefined}
                      onChange={(code) =>
                        updateLine(line.id, { deptCode: code })
                      }
                      options={deptOptions}
                      placeholder="Dept..."
                    />
                  </td>
                )}

                {/* Debit */}
                <td className="px-3 py-2">
                  <CurrencyInput
                    value={line.debit}
                    onChange={(val) => updateLine(line.id, { debit: val })}
                    disabled={disabled}
                    placeholder="0.00"
                  />
                </td>

                {/* Credit */}
                <td className="px-3 py-2">
                  <CurrencyInput
                    value={line.credit}
                    onChange={(val) => updateLine(line.id, { credit: val })}
                    disabled={disabled}
                    placeholder="0.00"
                  />
                </td>

                {/* Description */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) =>
                      updateLine(line.id, { description: e.target.value })
                    }
                    disabled={disabled}
                    placeholder="Line description..."
                    className="w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors duration-150 focus:outline-2 focus:outline-[var(--ring)] focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </td>

                {/* Delete */}
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => deleteRow(line.id)}
                    disabled={disabled || lines.length <= 2}
                    className="inline-flex items-center justify-center rounded-[var(--radius-button)] p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Delete row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      <div>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-dashed border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Add Row
        </button>
      </div>

      {/* Footer Totals */}
      <div className="flex items-center justify-end gap-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)] font-medium">
            Total Debit:
          </span>
          <span className="font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(totalDebit)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)] font-medium">
            Total Credit:
          </span>
          <span className="font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(totalCredit)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <span className="flex items-center gap-1 text-[var(--success)] font-semibold">
              <Check className="h-4 w-4" />
              Balanced
            </span>
          ) : (
            <span className="font-semibold tabular-nums text-[var(--destructive)]">
              Diff: {formatCurrency(difference)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
