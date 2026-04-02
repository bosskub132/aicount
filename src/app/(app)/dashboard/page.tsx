"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { FileText, Clock } from "lucide-react";

import { Tabs } from "@/components/tabs";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/badge";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  getWorkspaceTenantId,
  isDefaultWorkspaceTenantId,
} from "@/components/workspace-selector";
import {
  useMonthlyComparison,
  useStatusBreakdown,
  useApprovalQueue,
} from "@/lib/hooks/use-dashboard";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useDocuments, useDocumentMutations } from "@/lib/hooks/use-documents";
import { useToast } from "@/lib/stores/ui-store";

const COLORS = {
  revenue: "#059669",
  expense: "#DC2626",
  primary: "#2563EB",
  draft: "#475569",
  processing: "#1D4ED8",
  query: "#92400E",
  pending: "#92400E",
  approved: "#065F46",
  exported: "#6D28D9",
  rejected: "#DC2626",
  void: "#64748B",
} as const;

const STATUS_COLOR_MAP: Record<string, string> = {
  DRAFT: COLORS.draft,
  OCR_PROCESSING: COLORS.processing,
  QUERY: COLORS.query,
  ACTION_REQUIRED: COLORS.pending,
  PENDING_APPROVAL: COLORS.pending,
  APPROVED: COLORS.approved,
  EXPORTED: COLORS.exported,
  REJECTED: COLORS.rejected,
  VOID: COLORS.void,
};

const TAB_ITEMS = [
  { label: "Summary", value: "summary" },
  { label: "Pipeline", value: "pipeline" },
  { label: "Action Items", value: "actions" },
];

type DocRow = Record<string, unknown>;

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("summary");
  const mounted = useMounted();
  const router = useRouter();
  const toast = useToast();

  const tenantId = getWorkspaceTenantId();
  const isDefault = isDefaultWorkspaceTenantId(tenantId);

  const monthly = useMonthlyComparison(6);
  const statusBreakdown = useStatusBreakdown();
  const approvalQueue = useApprovalQueue();
  const recentDocs = useDocuments({ limit: 10 });
  const queryDocs = useDocuments({ status: "QUERY", limit: 50 });
  const actionRequiredDocs = useDocuments({ status: "ACTION_REQUIRED", limit: 50 });
  const { approve, reOcr } = useDocumentMutations();

  const rows = useMemo(() => monthly.data?.rows ?? [], [monthly.data]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc: { revenue: number; expense: number; docs: number }, r: { revenueAmount: number; expenseAmount: number; docCount: number }) => ({
        revenue: acc.revenue + Number(r.revenueAmount || 0),
        expense: acc.expense + Number(r.expenseAmount || 0),
        docs: acc.docs + Number(r.docCount || 0),
      }),
      { revenue: 0, expense: 0, docs: 0 }
    );
  }, [rows]);

  const pendingCount = useMemo(
    () => approvalQueue.data?.length ?? 0,
    [approvalQueue.data]
  );

  const queryCount = useMemo(
    () =>
      (statusBreakdown.data ?? []).find(
        (s: { status: string }) => s.status === "QUERY"
      )?.count ?? 0,
    [statusBreakdown.data]
  );

  const revenueTrend = useMemo(() => {
    if (rows.length < 2) return undefined;
    const last = Number(rows[rows.length - 1]?.revenueAmount || 0);
    const prev = Number(rows[rows.length - 2]?.revenueAmount || 0);
    if (prev === 0) return undefined;
    const pct = Math.round(((last - prev) / prev) * 100);
    return { direction: pct >= 0 ? ("up" as const) : ("down" as const), value: `${Math.abs(pct)}% vs prev month` };
  }, [rows]);

  const expenseTrend = useMemo(() => {
    if (rows.length < 2) return undefined;
    const last = Number(rows[rows.length - 1]?.expenseAmount || 0);
    const prev = Number(rows[rows.length - 2]?.expenseAmount || 0);
    if (prev === 0) return undefined;
    const pct = Math.round(((last - prev) / prev) * 100);
    return { direction: pct >= 0 ? ("up" as const) : ("down" as const), value: `${Math.abs(pct)}% vs prev month` };
  }, [rows]);

  const statusData = useMemo(
    () =>
      (statusBreakdown.data ?? []).map((s: { status: string; count: number }) => ({
        name: s.status.replace(/_/g, " "),
        value: Number(s.count),
        status: s.status,
      })),
    [statusBreakdown.data]
  );

  const [threeDaysAgo] = useState(() => Date.now() - 3 * 24 * 60 * 60 * 1000);
  const stuckDocs = useMemo(() => {
    const items = (actionRequiredDocs.data?.data ?? []) as DocRow[];
    return items.filter((d) => {
      const updated = d.updatedAt ? new Date(d.updatedAt as string).getTime() : threeDaysAgo + 1;
      return updated < threeDaysAgo;
    });
  }, [actionRequiredDocs.data, threeDaysAgo]);

  const avgDocsPerMonth = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round(totals.docs / rows.length);
  }, [rows, totals.docs]);

  const handleApprove = (docId: string) => {
    approve.mutate(docId, {
      onSuccess: () => toast.success("Document approved"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to approve"),
    });
  };

  const handleReOcr = (docId: string) => {
    reOcr.mutate(docId, {
      onSuccess: () => toast.success("Re-OCR started"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Re-OCR failed"),
    });
  };

  const recentColumns: Column<DocRow>[] = [
    {
      key: "issuerName",
      header: "Issuer",
      render: (row) => (row.issuerName as string) || (row.documentNumber as string) || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={String(row.status ?? "")} />,
    },
    {
      key: "grandTotal",
      header: "Amount",
      align: "right",
      render: (row) => {
        const amt = Number(row.grandTotal || 0);
        return amt > 0 ? `฿${amt.toLocaleString()}` : "—";
      },
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => {
        const d = row.createdAt ? new Date(row.createdAt as string) : null;
        return d ? d.toLocaleDateString() : "—";
      },
    },
  ];

  const approvalColumns: Column<DocRow>[] = [
    {
      key: "issuerName",
      header: "Issuer",
      render: (row) => (row.issuerName as string) || (row.documentNumber as string) || "—",
    },
    {
      key: "grandTotal",
      header: "Amount",
      align: "right",
      render: (row) => {
        const amt = Number(row.grandTotal || 0);
        return amt > 0 ? `฿${amt.toLocaleString()}` : "—";
      },
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => {
        const d = row.createdAt ? new Date(row.createdAt as string) : null;
        return d ? d.toLocaleDateString() : "—";
      },
    },
    {
      key: "actions",
      header: "Action",
      render: (row) => (
        <Button
          size="sm"
          variant="primary"
          loading={approve.isPending}
          onClick={(e) => {
            e.stopPropagation();
            handleApprove(String(row.id));
          }}
        >
          Approve
        </Button>
      ),
    },
  ];

  const queryColumns: Column<DocRow>[] = [
    {
      key: "issuerName",
      header: "Issuer",
      render: (row) => (row.issuerName as string) || (row.documentNumber as string) || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={String(row.status ?? "")} />,
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => {
        const d = row.createdAt ? new Date(row.createdAt as string) : null;
        return d ? d.toLocaleDateString() : "—";
      },
    },
    {
      key: "actions",
      header: "Action",
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          loading={reOcr.isPending}
          onClick={(e) => {
            e.stopPropagation();
            handleReOcr(String(row.id));
          }}
        >
          Re-OCR
        </Button>
      ),
    },
  ];

  const stuckColumns: Column<DocRow>[] = [
    {
      key: "issuerName",
      header: "Issuer",
      render: (row) => (row.issuerName as string) || (row.documentNumber as string) || "—",
    },
    {
      key: "updatedAt",
      header: "Last Updated",
      render: (row) => {
        const d = row.updatedAt ? new Date(row.updatedAt as string) : null;
        return d ? d.toLocaleDateString() : "—";
      },
    },
    {
      key: "grandTotal",
      header: "Amount",
      align: "right",
      render: (row) => {
        const amt = Number(row.grandTotal || 0);
        return amt > 0 ? `฿${amt.toLocaleString()}` : "—";
      },
    },
  ];

  const isLoading = !mounted || monthly.isLoading || statusBreakdown.isLoading;

  if (!mounted) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="100px" />
          ))}
        </div>
      </section>
    );
  }

  if (isDefault) {
    return (
      <section className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Select a client from the workspace menu in the header to load dashboard data.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <Tabs tabs={TAB_ITEMS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "summary" && (
        <div className="space-y-5">
          {/* Stat Cards */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rect" height="100px" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Pending Approvals"
                value={String(pendingCount)}
                href="/documents?tab=pending"
                trend={pendingCount > 0 ? "up" : "neutral"}
                trendValue={pendingCount > 0 ? `${pendingCount} awaiting review` : "All clear"}
              />
              <StatCard
                title="Queries"
                value={String(queryCount)}
                href="/documents?tab=query"
                trend={queryCount > 0 ? "up" : "neutral"}
                trendValue={queryCount > 0 ? `${queryCount} need attention` : "None"}
              />
              <StatCard
                title="Revenue (6mo)"
                value={`฿${totals.revenue.toLocaleString()}`}
                trend={revenueTrend?.direction}
                trendValue={revenueTrend?.value}
              />
              <StatCard
                title="Expense (6mo)"
                value={`฿${totals.expense.toLocaleString()}`}
                trend={expenseTrend?.direction}
                trendValue={expenseTrend?.value}
              />
            </div>
          )}

          {/* Charts Row */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Revenue vs Expense Line Chart */}
            <Card title="Revenue vs Expense Trend">
              {rows.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="yearMonth"
                      tickFormatter={(v: string) => v.slice(5)}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `฿${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value, name) => [
                        `฿${Number(value).toLocaleString()}`,
                        name === "revenueAmount" ? "Revenue" : "Expense",
                      ]}
                      labelFormatter={(label) => `Month: ${String(label)}`}
                    />
                    <Legend formatter={(value: string) => (value === "revenueAmount" ? "Revenue" : "Expense")} />
                    <Line
                      type="monotone"
                      dataKey="revenueAmount"
                      stroke={COLORS.revenue}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenseAmount"
                      stroke={COLORS.expense}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={<FileText className="h-8 w-8" />}
                  title="No trend data"
                  description="Upload documents to see revenue and expense trends"
                />
              )}
            </Card>

            {/* Status Donut Chart */}
            <Card title="Document Status Breakdown">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {statusData.map((entry: { status: string }, idx: number) => (
                        <Cell
                          key={idx}
                          fill={STATUS_COLOR_MAP[entry.status] || COLORS.draft}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [Number(value), String(name)]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={<FileText className="h-8 w-8" />}
                  title="No status data"
                  description="Document statuses will appear here"
                />
              )}
            </Card>
          </div>

          {/* Recent Documents */}
          <Card title="Recent Documents">
            {(!mounted || recentDocs.isLoading) ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} variant="text" height="20px" />
                ))}
              </div>
            ) : (
              <DataTable
                columns={recentColumns}
                data={(recentDocs.data?.data ?? []) as DocRow[]}
                onRowClick={(row) => router.push(`/extractions?docId=${row.id}`)}
                emptyMessage="No documents yet"
              />
            )}
          </Card>
        </div>
      )}

      {activeTab === "pipeline" && (
        <div className="space-y-5">
          {/* Docs per month bar chart */}
          <Card title="Documents per Month">
            {rows.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="yearMonth"
                    tickFormatter={(v: string) => v.slice(5)}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [Number(value), "Documents"]}
                    labelFormatter={(label) => `Month: ${String(label)}`}
                  />
                  <Bar dataKey="docCount" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="No pipeline data"
                description="Document volume will appear once you start uploading"
              />
            )}
          </Card>

          {/* Average docs stat */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Avg Documents / Month"
              value={String(avgDocsPerMonth)}
              trend="neutral"
              trendValue={`Over ${rows.length} months`}
            />
          </div>

          {/* Status funnel */}
          <Card title="Status Funnel">
            {statusData.length > 0 ? (
              <div className="space-y-3">
                {statusData.map((entry: { name: string; value: number; status: string }) => {
                  const maxCount = Math.max(...statusData.map((s: { value: number }) => s.value), 1);
                  const widthPct = Math.max((entry.value / maxCount) * 100, 4);
                  return (
                    <div key={entry.status} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-xs text-[var(--muted-foreground)] text-right">
                        {entry.name}
                      </span>
                      <div className="flex-1">
                        <div
                          className="h-6 rounded"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: STATUS_COLOR_MAP[entry.status] || COLORS.draft,
                          }}
                        />
                      </div>
                      <span className="w-10 text-xs font-medium tabular-nums text-[var(--foreground)]">
                        {entry.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="No status data"
                description="Status breakdown will appear here"
              />
            )}
          </Card>
        </div>
      )}

      {activeTab === "actions" && (
        <div className="space-y-5">
          {/* Pending approvals */}
          <Card title="Pending Approvals">
            {(!mounted || approvalQueue.isLoading) ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="text" height="20px" />
                ))}
              </div>
            ) : (
              <DataTable
                columns={approvalColumns}
                data={(approvalQueue.data ?? []) as DocRow[]}
                onRowClick={(row) => router.push(`/extractions?docId=${row.id}`)}
                emptyMessage="No pending approvals"
              />
            )}
          </Card>

          {/* Query documents */}
          <Card title="Query Documents">
            {(!mounted || queryDocs.isLoading) ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="text" height="20px" />
                ))}
              </div>
            ) : (
              <DataTable
                columns={queryColumns}
                data={(queryDocs.data?.data ?? []) as DocRow[]}
                onRowClick={(row) => router.push(`/extractions?docId=${row.id}`)}
                emptyMessage="No query documents"
              />
            )}
          </Card>

          {/* Stuck action required */}
          <Card title="Stuck Documents (Action Required > 3 days)">
            {(!mounted || actionRequiredDocs.isLoading) ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="text" height="20px" />
                ))}
              </div>
            ) : stuckDocs.length > 0 ? (
              <DataTable
                columns={stuckColumns}
                data={stuckDocs}
                onRowClick={(row) => router.push(`/extractions?docId=${row.id}`)}
                emptyMessage="No stuck documents"
              />
            ) : (
              <EmptyState
                icon={<Clock className="h-8 w-8" />}
                title="No stuck documents"
                description="All action-required documents are being handled promptly"
              />
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
