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

import { useMonthlyComparison } from "@/lib/hooks/use-monthly-comparison";
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

interface MonthlyRow {
  accountCode: string;
  accountName: string;
  section: "revenue" | "expense";
  months: number[]; // 12 elements, index 0 = Jan
  ytd: number;
}

interface MonthlyComparisonData {
  rows: MonthlyRow[];
  ytdRevenue: number;
  ytdExpenses: number;
  ytdNetProfit: number;
  bestMonth: { month: number; amount: number } | null;
  revenueByMonth: number[];
  expenseByMonth: number[];
  netProfitByMonth: number[];
  currentMonth: number; // 1-based, months after this are future
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function MonthlyComparisonContent() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-01`;
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const year = useMemo(() => parseInt(period.split("-")[0], 10), [period]);

  const mounted = useMounted();
  const { data, isLoading: queryLoading } = useMonthlyComparison({ year });
  const isLoading = !mounted || queryLoading;

  const reportData = data as MonthlyComparisonData | undefined;
  const currentMonth = reportData?.currentMonth ?? 12;

  const history = useReportHistory({ reportType: "monthly-comparison" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "monthly-comparison",
      period: String(year),
      scope: "yearly",
      filters: {},
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, year]);

  const statCards = useMemo(() => {
    const bestLabel = reportData?.bestMonth
      ? `${MONTH_LABELS[reportData.bestMonth.month - 1]} (${formatCurrency(reportData.bestMonth.amount)})`
      : "N/A";
    return [
      { label: "YTD Revenue", value: formatCurrency(reportData?.ytdRevenue ?? 0), color: "border-l-[var(--success)]" },
      { label: "YTD Expenses", value: formatCurrency(reportData?.ytdExpenses ?? 0), color: "border-l-[var(--destructive)]" },
      {
        label: "YTD Net Profit",
        value: formatCurrency(reportData?.ytdNetProfit ?? 0),
        color: (reportData?.ytdNetProfit ?? 0) >= 0 ? "border-l-[var(--success)]" : "border-l-[var(--destructive)]",
      },
      { label: "Best Month", value: bestLabel, color: "border-l-[var(--primary)]" },
    ];
  }, [reportData]);

  const revenueRows = useMemo(() => reportData?.rows?.filter((r) => r.section === "revenue") ?? [], [reportData]);
  const expenseRows = useMemo(() => reportData?.rows?.filter((r) => r.section === "expense") ?? [], [reportData]);

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Monthly Comparison</h1>
          <p className="text-sm text-[var(--muted-foreground)]">เปรียบเทียบรายเดือน &mdash; 12-month revenue and expense breakdown</p>
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
        config={{}}
        scope="yearly"
        onScopeChange={() => {}}
        period={period}
        onPeriodChange={setPeriod}
        lockedScope="yearly"
        onHistoryClick={() => setShowHistory(true)}
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      ) : !reportData?.rows?.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No monthly comparison data"
          description="There are no journal entries for the selected year."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="sticky left-0 z-10 bg-[var(--muted)] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] min-w-[200px]">
                  Account
                </th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] min-w-[90px]">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-[var(--foreground)] min-w-[100px]">
                  YTD
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue */}
              <tr className="bg-green-50">
                <td colSpan={14} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-green-700">Revenue</td>
              </tr>
              {revenueRows.map((row) => (
                <MonthlyRowComponent key={row.accountCode} row={row} currentMonth={currentMonth} />
              ))}
              <SummaryRow label="Total Revenue" months={reportData.revenueByMonth ?? []} ytd={reportData.ytdRevenue} currentMonth={currentMonth} bgClass="bg-green-50/60" textClass="text-green-700" />

              {/* Expenses */}
              <tr className="bg-red-50">
                <td colSpan={14} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-700">Expenses</td>
              </tr>
              {expenseRows.map((row) => (
                <MonthlyRowComponent key={row.accountCode} row={row} currentMonth={currentMonth} />
              ))}
              <SummaryRow label="Total Expenses" months={reportData.expenseByMonth ?? []} ytd={reportData.ytdExpenses} currentMonth={currentMonth} bgClass="bg-red-50/60" textClass="text-red-700" />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--foreground)] bg-[var(--muted)] font-bold">
                <td className="sticky left-0 z-10 bg-[var(--muted)] px-4 py-3 text-[var(--foreground)]">Net Profit</td>
                {(reportData.netProfitByMonth ?? []).map((val, i) => (
                  <td key={i} className={`px-3 py-3 text-right tabular-nums ${i >= currentMonth ? "text-[var(--muted-foreground)]" : val >= 0 ? "text-green-700" : "text-[var(--destructive)]"}`}>
                    {i >= currentMonth ? "\u2014" : formatCurrency(val)}
                  </td>
                ))}
                <td className={`px-3 py-3 text-right tabular-nums font-bold ${reportData.ytdNetProfit >= 0 ? "text-green-700" : "text-[var(--destructive)]"}`}>
                  {formatCurrency(reportData.ytdNetProfit)}
                </td>
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MonthlyRowComponent({ row, currentMonth }: { row: MonthlyRow; currentMonth: number }) {
  return (
    <tr className="border-b border-[var(--muted)] hover:bg-[var(--muted)]/30">
      <td className="sticky left-0 z-10 bg-white px-4 py-2.5 text-[var(--foreground)]">
        <span className="font-mono text-xs text-[var(--muted-foreground)] mr-2">{row.accountCode}</span>
        {row.accountName}
      </td>
      {row.months.map((val, i) => (
        <td key={i} className={`px-3 py-2.5 text-right tabular-nums ${i >= currentMonth ? "text-[var(--muted-foreground)]" : ""}`}>
          {i >= currentMonth ? "\u2014" : val > 0 ? formatCurrency(val) : ""}
        </td>
      ))}
      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(row.ytd)}</td>
    </tr>
  );
}

function SummaryRow({
  label,
  months,
  ytd,
  currentMonth,
  bgClass,
  textClass,
}: {
  label: string;
  months: number[];
  ytd: number;
  currentMonth: number;
  bgClass: string;
  textClass: string;
}) {
  return (
    <tr className={`border-b border-[var(--border)] ${bgClass} font-semibold`}>
      <td className={`sticky left-0 z-10 ${bgClass} px-4 py-2 ${textClass}`}>{label}</td>
      {months.map((val, i) => (
        <td key={i} className={`px-3 py-2 text-right tabular-nums ${i >= currentMonth ? "text-[var(--muted-foreground)]" : textClass}`}>
          {i >= currentMonth ? "\u2014" : formatCurrency(val)}
        </td>
      ))}
      <td className={`px-3 py-2 text-right tabular-nums font-bold ${textClass}`}>{formatCurrency(ytd)}</td>
    </tr>
  );
}

export default function MonthlyComparisonPage() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <MonthlyComparisonContent />
    </Suspense>
  );
}
