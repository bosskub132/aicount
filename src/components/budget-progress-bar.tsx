"use client";

import Link from "next/link";

interface BudgetProgressBarProps {
  spent: number;
  budget: number | null;
  threshold?: number;
  tier1Count?: number;
  tier2Count?: number;
  tier3Count?: number;
}

export function BudgetProgressBar({
  spent,
  budget,
  threshold = 80,
  tier1Count = 0,
  tier2Count = 0,
  tier3Count = 0,
}: BudgetProgressBarProps) {
  if (budget === null) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 mt-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          No monthly budget set.{" "}
          <Link
            href="/settings/accounting/ai-usage"
            className="text-[var(--primary)] underline underline-offset-2 hover:opacity-80"
          >
            Set budget
          </Link>
        </p>
      </div>
    );
  }

  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  let barColor: string;
  let statusText: string;

  if (pct >= 100) {
    barColor = "bg-[var(--destructive)]";
    statusText = "Budget exceeded";
  } else if (pct >= threshold) {
    barColor = "bg-[var(--warning)]";
    statusText = `${pct.toFixed(0)}% of budget used — approaching limit`;
  } else {
    barColor = "bg-[var(--success)]";
    statusText = `${pct.toFixed(0)}% of budget used`;
  }

  const totalTierCount = tier1Count + tier2Count + tier3Count;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--foreground)]">Monthly Budget</span>
        <span className="text-sm tabular-nums text-[var(--muted-foreground)]">
          ${spent.toFixed(2)} / ${budget.toFixed(2)}
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-[var(--muted)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{statusText}</p>

      {totalTierCount > 0 && (
        <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--success)] inline-block" />
            T1: {tier1Count}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--primary)] inline-block" />
            T2: {tier2Count}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--warning)] inline-block" />
            T3: {tier3Count}
          </span>
        </div>
      )}
    </div>
  );
}
