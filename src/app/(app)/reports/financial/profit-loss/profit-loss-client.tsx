"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Download, FileText } from "lucide-react";

import { ReportFilterBar } from "@/components/report-filter-bar";
import { ReportStatCards } from "@/components/report-stat-cards";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ReportHistoryDrawer, type ReportHistoryItem } from "@/components/report-history-drawer";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

import { useProfitLoss } from "@/lib/hooks/use-profit-loss";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  useReportHistory,
  useLockReport,
  useUnlockReport,
  useDeleteReport,
  useRestoreReport,
} from "@/lib/hooks/use-report-history";
import { useGenerateReportPdf } from "@/lib/hooks/use-report-pdf";
import { formatCurrency } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PnlRow {
  accountCode: string;
  accountName: string;
  section: "revenue" | "expense";
  amount: number;
  comparisonAmount?: number;
  variance?: number;
}

interface PnlData {
  rows: PnlRow[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  comparisonTotalRevenue?: number;
  comparisonTotalExpenses?: number;
  comparisonNetProfit?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_CONFIG = { showDepartment: true, showComparison: true };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExpenseAmount(amount: number): string {
  if (amount === 0) return formatCurrency(0);
  return `(${formatCurrency(Math.abs(amount))})`;
}

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function ProfitLossContent() {
  const mounted = useMounted();
  const [scope, setScope] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [department, setDepartment] = useState("all");
  const [comparison, setComparison] = useState("none");
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const { data, isLoading: queryLoading } = useProfitLoss({
    period,
    scope,
    department: department !== "all" ? department : undefined,
    comparison: comparison !== "none" ? comparison : undefined,
  });
  const isLoading = !mounted || queryLoading;

  const reportData = data as PnlData | undefined;
  const hasComparison = comparison !== "none";

  const history = useReportHistory({ reportType: "profit-loss" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "profit-loss",
      period,
      scope,
      filters: { department, comparison },
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope, department, comparison]);

  const statCards = useMemo(() => [
    { label: "Total Revenue", value: formatCurrency(reportData?.totalRevenue ?? 0), color: "border-l-[var(--success)]" },
    { label: "Total Expenses", value: formatCurrency(reportData?.totalExpenses ?? 0), color: "border-l-[var(--destructive)]" },
    {
      label: "Net Profit",
      value: formatCurrency(reportData?.netProfit ?? 0),
      color: (reportData?.netProfit ?? 0) >= 0 ? "border-l-[var(--success)]" : "border-l-[var(--destructive)]",
    },
    {
      label: "Profit Margin",
      value: `${(reportData?.profitMargin ?? 0).toFixed(2)}%`,
      color: "border-l-[var(--primary)]",
    },
  ], [reportData]);

  const revenueRows = useMemo(
    () => reportData?.rows?.filter((r) => r.section === "revenue") ?? [],
    [reportData],
  );

  const expenseRows = useMemo(
    () => reportData?.rows?.filter((r) => r.section === "expense") ?? [],
    [reportData],
  );

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Profit &amp; Loss</h1>
          <p className="text-sm text-[var(--muted-foreground)]">งบกำไรขาดทุน &mdash; Revenue and expense summary</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => window.history.back()}>
            All Reports
          </Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />}>Export</Button>
          <Button icon={<FileText className="h-4 w-4" />} onClick={handleGeneratePdf} loading={generatePdf.isPending}>
            Generate PDF
          </Button>
        </div>
      </div>

      <ReportStatCards items={statCards} isLoading={isLoading} />

      <ReportFilterBar
        config={FILTER_CONFIG}
        scope={scope}
        onScopeChange={setScope}
        period={period}
        onPeriodChange={setPeriod}
        department={department}
        onDepartmentChange={setDepartment}
        comparison={comparison}
        onComparisonChange={setComparison}
        onHistoryClick={() => setShowHistory(true)}
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      ) : !reportData?.rows?.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No profit & loss data"
          description="There are no journal entries for the selected period."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Account</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Amount</th>
                {hasComparison && (
                  <>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Comparison</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Variance</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Revenue Section */}
              <tr className="bg-green-50">
                <td colSpan={hasComparison ? 4 : 2} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-green-700">
                  Revenue
                </td>
              </tr>
              {revenueRows.map((row) => (
                <tr key={row.accountCode} className="border-b border-[var(--muted)] hover:bg-[var(--muted)]/30">
                  <td className="px-4 py-2.5 pl-8 text-[var(--foreground)]">
                    <span className="font-mono text-xs text-[var(--muted-foreground)] mr-2">{row.accountCode}</span>
                    {row.accountName}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.amount)}</td>
                  {hasComparison && (
                    <>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.comparisonAmount ?? 0)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${(row.variance ?? 0) >= 0 ? "text-green-600" : "text-[var(--destructive)]"}`}>
                        {formatCurrency(row.variance ?? 0)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              <tr className="border-b border-[var(--border)] bg-green-50/60 font-semibold">
                <td className="px-4 py-2 text-right text-green-700">Total Revenue</td>
                <td className="px-4 py-2 text-right tabular-nums text-green-700">{formatCurrency(reportData.totalRevenue)}</td>
                {hasComparison && (
                  <>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(reportData.comparisonTotalRevenue ?? 0)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency((reportData.totalRevenue) - (reportData.comparisonTotalRevenue ?? 0))}
                    </td>
                  </>
                )}
              </tr>

              {/* Expense Section */}
              <tr className="bg-red-50">
                <td colSpan={hasComparison ? 4 : 2} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-700">
                  Expenses
                </td>
              </tr>
              {expenseRows.map((row) => (
                <tr key={row.accountCode} className="border-b border-[var(--muted)] hover:bg-[var(--muted)]/30">
                  <td className="px-4 py-2.5 pl-8 text-[var(--foreground)]">
                    <span className="font-mono text-xs text-[var(--muted-foreground)] mr-2">{row.accountCode}</span>
                    {row.accountName}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--destructive)]">{formatExpenseAmount(row.amount)}</td>
                  {hasComparison && (
                    <>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--destructive)]">{formatExpenseAmount(row.comparisonAmount ?? 0)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${(row.variance ?? 0) >= 0 ? "text-green-600" : "text-[var(--destructive)]"}`}>
                        {formatCurrency(row.variance ?? 0)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              <tr className="border-b border-[var(--border)] bg-red-50/60 font-semibold">
                <td className="px-4 py-2 text-right text-red-700">Total Expenses</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-700">{formatExpenseAmount(reportData.totalExpenses)}</td>
                {hasComparison && (
                  <>
                    <td className="px-4 py-2 text-right tabular-nums text-[var(--destructive)]">
                      {formatExpenseAmount(reportData.comparisonTotalExpenses ?? 0)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency((reportData.totalExpenses) - (reportData.comparisonTotalExpenses ?? 0))}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--foreground)] bg-[var(--muted)] font-bold text-base">
                <td className="px-4 py-3 text-[var(--foreground)]">Net Profit</td>
                <td className={`px-4 py-3 text-right tabular-nums ${reportData.netProfit >= 0 ? "text-green-700" : "text-[var(--destructive)]"}`}>
                  {reportData.netProfit >= 0 ? formatCurrency(reportData.netProfit) : formatExpenseAmount(reportData.netProfit)}
                </td>
                {hasComparison && (
                  <>
                    <td className={`px-4 py-3 text-right tabular-nums ${(reportData.comparisonNetProfit ?? 0) >= 0 ? "text-green-700" : "text-[var(--destructive)]"}`}>
                      {(reportData.comparisonNetProfit ?? 0) >= 0
                        ? formatCurrency(reportData.comparisonNetProfit ?? 0)
                        : formatExpenseAmount(reportData.comparisonNetProfit ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(reportData.netProfit - (reportData.comparisonNetProfit ?? 0))}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <PdfPreviewModal isOpen={showPdfPreview} onClose={() => setShowPdfPreview(false)} pdfUrl={pdfUrl} />

      <ReportHistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        items={historyItems}
        isLoading={history.isLoading}
        activeFilter={historyFilter}
        onFilterChange={setHistoryFilter}
        onDownload={() => {}}
        onLock={(id) => lockReport.mutate(id)}
        onUnlock={(id) => unlockReport.mutate(id)}
        onDelete={(id) => deleteReport.mutate(id)}
        onRestore={(id) => restoreReport.mutate(id)}
        onPreview={() => {}}
      />
    </section>
  );
}

export default function ProfitLossClient() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <ProfitLossContent />
    </Suspense>
  );
}
