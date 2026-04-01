"use client";

import { useState, useEffect, useRef } from "react";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/skeleton";
import { DailyCostChart } from "@/components/daily-cost-chart";
import { TierDistributionChart } from "@/components/tier-distribution-chart";
import { useBackofficeAnalytics, useBackofficeTenantUsage } from "@/lib/hooks/use-backoffice";

function getMonthOptions() {
  const options: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: d.toLocaleString("en-US", { year: "numeric", month: "long" }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return options;
}

function BudgetBar({ used, budget }: { used: number; budget: number }) {
  const pct = budget > 0 ? Math.min((used / budget) * 100, 100) : 0;
  const color = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#059669";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-[var(--muted)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="tabular-nums text-xs text-[var(--muted-foreground)]">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

interface TenantUsageRow {
  tenantId: string;
  tenantName: string;
  totalDocuments: number;
  totalCostUsd: number;
  avgCostPerDoc: number;
  budgetUsd: number;
  tier1Pct: number;
}

export default function BackofficeOverviewPage() {
  const monthOptions = getMonthOptions();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { year, month } = monthOptions[selectedIndex];

  const { data: analytics, isLoading: analyticsLoading } = useBackofficeAnalytics(year, month);
  const { data: tenantData, isLoading: tenantLoading } = useBackofficeTenantUsage(year, month, debouncedSearch, page);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const overview = analytics?.overview;
  const dailyCosts = analytics?.dailyCosts ?? [];
  const tierBreakdown = analytics?.tierBreakdown;

  const tenants: TenantUsageRow[] = tenantData?.data ?? [];
  const meta = tenantData?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  function formatCost(val: number | undefined) {
    if (val === undefined) return "$—";
    return `$${val.toFixed(4)}`;
  }

  function formatCostShort(val: number | undefined) {
    if (val === undefined) return "$—";
    if (val >= 1) return `$${val.toFixed(2)}`;
    return `$${val.toFixed(4)}`;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">AI Overview</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Platform-wide AI usage, costs, and tier distribution
          </p>
        </div>
        <select
          className="rounded-[var(--radius-input)] border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          value={selectedIndex}
          onChange={(e) => {
            setSelectedIndex(Number(e.target.value));
            setPage(1);
          }}
        >
          {monthOptions.map((opt, i) => (
            <option key={i} value={i}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {analyticsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-7 w-20 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              title="Total AI Spend"
              value={overview ? `$${overview.totalCostUsd.toFixed(2)}` : "$0.00"}
              trend={overview?.costChange > 0 ? "up" : overview?.costChange < 0 ? "down" : "neutral"}
              trendValue={overview?.costChange !== undefined ? `${Math.abs(overview.costChange).toFixed(1)}% vs last month` : undefined}
            />
            <StatCard
              title="Total Documents"
              value={overview ? overview.totalDocuments.toLocaleString() : "0"}
              trend={overview?.docChange > 0 ? "up" : overview?.docChange < 0 ? "down" : "neutral"}
              trendValue={overview?.docChange !== undefined ? `${Math.abs(overview.docChange).toFixed(1)}% vs last month` : undefined}
            />
            <StatCard
              title="Active Tenants"
              value={overview ? String(overview.activeTenants) : "0"}
            />
            <StatCard
              title="Avg Cost / Doc"
              value={overview ? `$${overview.avgCostPerDoc.toFixed(4)}` : "$0.0000"}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {analyticsLoading ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
              <Skeleton className="h-4 w-40 mb-3" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          ) : (
            <DailyCostChart data={dailyCosts} />
          )}
        </div>
        <div className="lg:col-span-1">
          {analyticsLoading ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-[130px] w-full" />
            </div>
          ) : (
            <TierDistributionChart
              tier1={tierBreakdown?.tier1 ?? 0}
              tier2={tierBreakdown?.tier2 ?? 0}
              tier3={tierBreakdown?.tier3 ?? 0}
              totalDocs={overview?.totalDocuments ?? 0}
            />
          )}
        </div>
      </div>

      {/* Per-tenant table */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold">Tenant Usage</h2>
          <input
            type="search"
            placeholder="Search tenants…"
            className="rounded-[var(--radius-input)] border border-[var(--border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Tenant", "Documents", "AI Cost", "Avg / Doc", "Budget", "T1 %"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] uppercase border-b border-[var(--border)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenantLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-3 py-2 border-b border-[var(--muted)]">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tenants.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-[var(--muted-foreground)]"
                  >
                    No tenant data for this period
                  </td>
                </tr>
              ) : (
                tenants.map((row) => (
                  <tr key={row.tenantId} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="px-3 py-2 border-b border-[var(--muted)] font-medium">
                      {row.tenantName}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] tabular-nums">
                      {row.totalDocuments.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] tabular-nums">
                      {formatCostShort(row.totalCostUsd)}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] tabular-nums">
                      {formatCost(row.avgCostPerDoc)}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)]">
                      <BudgetBar used={row.totalCostUsd} budget={row.budgetUsd} />
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] tabular-nums">
                      {row.tier1Pct !== undefined ? `${row.tier1Pct.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)] tabular-nums">
              {meta.total} tenants total
            </p>
            <div className="flex items-center gap-1">
              <button
                className="rounded-[var(--radius-input)] border border-[var(--border)] px-2.5 py-1 text-xs disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <span className="px-2 text-xs tabular-nums text-[var(--muted-foreground)]">
                {page} / {totalPages}
              </span>
              <button
                className="rounded-[var(--radius-input)] border border-[var(--border)] px-2.5 py-1 text-xs disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
