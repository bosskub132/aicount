"use client";

import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/skeleton";
import { BudgetProgressBar } from "@/components/budget-progress-bar";
import { useTenantAiUsage } from "@/lib/hooks/use-ai-usage";

export default function AiUsagePage() {
  const { data, isLoading, error } = useTenantAiUsage();

  const trend =
    data?.costChange == null
      ? "neutral"
      : data.costChange > 0
        ? "up"
        : data.costChange < 0
          ? "down"
          : "neutral";

  const trendValue =
    data?.costChange != null
      ? `${data.costChange > 0 ? "+" : ""}${data.costChange.toFixed(1)}% vs last month`
      : undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">AI Usage</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Monitor your workspace AI processing costs and budget.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton variant="rect" height="96px" />
          <Skeleton variant="rect" height="96px" />
          <Skeleton variant="rect" height="96px" />
        </div>
      ) : error ? (
        <p className="text-sm text-[var(--destructive)]">Failed to load AI usage data.</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Documents Processed"
              value={data.documentCount.toLocaleString()}
            />
            <StatCard
              title="Total AI Cost"
              value={`$${data.totalCostUsd.toFixed(2)}`}
              trend={trend}
              trendValue={trendValue}
            />
            <StatCard
              title="Avg Cost / Doc"
              value={`$${data.avgCostPerDoc.toFixed(4)}`}
            />
          </div>

          <BudgetProgressBar
            spent={data.totalCostUsd}
            budget={data.budget}
            threshold={data.budgetAlertThreshold}
            tier1Count={data.tier1Count}
            tier2Count={data.tier2Count}
            tier3Count={data.tier3Count}
          />
        </>
      ) : null}
    </div>
  );
}
