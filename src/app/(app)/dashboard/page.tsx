"use client";

import { useEffect, useState } from "react";
import { getWorkspaceTenantId, isDefaultWorkspaceTenantId } from "@/components/workspace-selector";

type MonthlyRow = {
  yearMonth: string;
  revenueAmount: number;
  expenseAmount: number;
  docCount: number;
};

export default function DashboardPage() {
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"analytics" | "errors">("analytics");
  const [isDefaultTenant, setIsDefaultTenant] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const tenantId = getWorkspaceTenantId();
    const isDefault = isDefaultWorkspaceTenantId(tenantId);
    setIsDefaultTenant(isDefault);
    setMounted(true);
    if (isDefault) return;
    fetch(`/api/tenants/${tenantId}/reports/monthly-comparison?months=6`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Failed");
        setRows(json.data?.rows || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"));
  }, []);

  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += Number(r.revenueAmount || 0);
      acc.expense += Number(r.expenseAmount || 0);
      acc.docs += Number(r.docCount || 0);
      return acc;
    },
    { revenue: 0, expense: 0, docs: 0 }
  );

  const denom = totals.revenue + totals.expense;
  const revenueSharePct =
    totals.docs > 0 && denom > 0 ? Math.round((totals.revenue / denom) * 100) : null;

  return (
    <section className="space-y-5">
      {mounted && isDefaultTenant && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Select a client from the workspace menu in the header to load overview figures for that tenant.
        </div>
      )}
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("analytics")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "analytics" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
          </svg>
          Summary
        </button>
        <button
          type="button"
          onClick={() => setTab("errors")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "errors" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Errors
        </button>
      </div>

      {tab === "analytics" && (
        <div className="space-y-5">
          {/* Metrics header */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Workspace summary</h2>
                <p className="text-xs text-slate-500">
                  From the monthly comparison report (last 6 months). Amounts reflect approved documents in that window—not OCR model scores.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <MetricCard
                label="Revenue share"
                value={revenueSharePct !== null ? `${revenueSharePct}%` : "—"}
                hint={
                  revenueSharePct !== null
                    ? "Revenue ÷ (revenue + expense). Mix of amounts, not extraction quality."
                    : "No amounts in range"
                }
                color="text-slate-800"
              />
              <MetricCard
                label="Documents"
                value={String(totals.docs)}
                hint="Document count in report window"
                color="text-slate-800"
              />
              <MetricCard label="Revenue (6m)" value={`฿${totals.revenue.toLocaleString()}`} hint="Approved revenue" color="text-emerald-600" />
              <MetricCard label="Expense (6m)" value={`฿${totals.expense.toLocaleString()}`} hint="Approved expense" color="text-red-600" />
            </div>
          </div>

          {/* Trend */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700">Monthly trend (last 6 months)</h3>
            <div className="mt-4">
              {rows.length > 0 ? (
                <div className="flex items-end gap-2" style={{ height: 120 }}>
                  {rows.map((r) => {
                    const maxVal = Math.max(...rows.map((x) => Number(x.revenueAmount || 0) + Number(x.expenseAmount || 0)), 1);
                    const h = ((Number(r.revenueAmount || 0) + Number(r.expenseAmount || 0)) / maxVal) * 100;
                    return (
                      <div key={r.yearMonth} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-blue-200" style={{ height: `${h}%`, minHeight: 4 }} />
                        <span className="text-[10px] text-slate-400">{r.yearMonth.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">No data yet</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {tab === "errors" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Developer Section - This page displays technical error logs and is intended for developers/technical staff only.
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-800">Error Monitoring</h2>
            <p className="text-xs text-slate-500">Track and manage application errors across all sources</p>
            <div className="mt-4 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Message</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">No errors found</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}
