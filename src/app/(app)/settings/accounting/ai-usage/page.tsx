"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/skeleton";
import { BudgetProgressBar } from "@/components/budget-progress-bar";
import { Toggle } from "@/components/toggle";
import { useTenantAiUsage } from "@/lib/hooks/use-ai-usage";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export default function AiUsagePage() {
  const { data, isLoading, error } = useTenantAiUsage();
  const toast = useToast();
  const tenantId = getWorkspaceTenantId();
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);

  useEffect(() => {
    if (data?.suggestionsEnabled !== undefined) {
      setSuggestionsEnabled(data.suggestionsEnabled);
    }
  }, [data?.suggestionsEnabled]);

  async function handleToggleSuggestions(enabled: boolean) {
    setSuggestionsEnabled(enabled);
    try {
      const res = await fetch("/api/settings/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionsEnabled: enabled }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(
        enabled ? "AI suggestions enabled" : "AI suggestions disabled"
      );
    } catch {
      setSuggestionsEnabled(!enabled);
      toast.error("Failed to update suggestion setting");
    }
  }

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
            threshold={data.budgetAlertThreshold * 100}
            tier1Count={data.tier1Count}
            tier2Count={data.tier2Count}
            tier3Count={data.tier3Count}
          />

          {/* Suggestions Toggle */}
          <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                AI Suggestions
              </h3>
              <p className="text-xs text-gray-500">
                Show automatic suggestions for GL accounts, WHT rates, and more
              </p>
            </div>
            <Toggle
              checked={suggestionsEnabled}
              onChange={handleToggleSuggestions}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
