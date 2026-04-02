"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Download, FileText, AlertTriangle } from "lucide-react";

import { ReportFilterBar } from "@/components/report-filter-bar";
import { ReportStatCards } from "@/components/report-stat-cards";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ReportHistoryDrawer, type ReportHistoryItem } from "@/components/report-history-drawer";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

import { useCashFlow } from "@/lib/hooks/use-cash-flow";
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

interface CfRow {
  label: string;
  amount: number;
  comparisonAmount?: number;
  isSubtotal?: boolean;
}

interface CfSection {
  section: "operating" | "investing" | "financing";
  rows: CfRow[];
  total: number;
  comparisonTotal?: number;
}

interface CfData {
  sections: CfSection[];
  operatingTotal: number;
  investingTotal: number;
  financingTotal: number;
  netCashChange: number;
  unclassifiedAccounts?: number;
  comparisonOperatingTotal?: number;
  comparisonInvestingTotal?: number;
  comparisonFinancingTotal?: number;
  comparisonNetCashChange?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_CONFIG = { showComparison: true };

const SECTION_META: Record<string, { label: string; bgClass: string; textClass: string }> = {
  operating: { label: "Operating Activities", bgClass: "bg-blue-50", textClass: "text-blue-700" },
  investing: { label: "Investing Activities", bgClass: "bg-amber-50", textClass: "text-amber-700" },
  financing: { label: "Financing Activities", bgClass: "bg-purple-50", textClass: "text-purple-700" },
};

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function CashFlowContent() {
  const [scope, setScope] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [comparison, setComparison] = useState("none");
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const mounted = useMounted();

  const { data, isLoading: queryLoading } = useCashFlow({
    period,
    scope,
    comparison: comparison !== "none" ? comparison : undefined,
  });

  const isLoading = !mounted || queryLoading;

  const reportData = data as CfData | undefined;
  const hasComparison = comparison !== "none";

  const history = useReportHistory({ reportType: "cash-flow" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "cash-flow",
      period,
      scope,
      filters: { comparison },
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope, comparison]);

  const statCards = useMemo(() => [
    { label: "Operating", value: formatCurrency(reportData?.operatingTotal ?? 0), color: "border-l-[var(--primary)]" },
    { label: "Investing", value: formatCurrency(reportData?.investingTotal ?? 0), color: "border-l-[var(--warning)]" },
    { label: "Financing", value: formatCurrency(reportData?.financingTotal ?? 0), color: "border-l-[var(--secondary)]" },
    {
      label: "Net Cash Change",
      value: formatCurrency(reportData?.netCashChange ?? 0),
      color: (reportData?.netCashChange ?? 0) >= 0 ? "border-l-[var(--success)]" : "border-l-[var(--destructive)]",
    },
  ], [reportData]);

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Cash Flow Statement</h1>
          <p className="text-sm text-[var(--muted-foreground)]">งบกระแสเงินสด &mdash; Cash inflows and outflows</p>
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
        comparison={comparison}
        onComparisonChange={setComparison}
        onHistoryClick={() => setShowHistory(true)}
      />

      {/* Unclassified warning */}
      {!isLoading && reportData && (reportData.unclassifiedAccounts ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {reportData.unclassifiedAccounts} account(s) are not classified into Operating, Investing, or Financing. Review your chart of accounts.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      ) : !reportData?.sections?.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No cash flow data"
          description="There are no journal entries for the selected period."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Item</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Amount</th>
                {hasComparison && (
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Comparison</th>
                )}
              </tr>
            </thead>
            <tbody>
              {reportData.sections.map((sec) => {
                const meta = SECTION_META[sec.section];
                return (
                  <CashFlowSection
                    key={sec.section}
                    meta={meta}
                    section={sec}
                    hasComparison={hasComparison}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--foreground)] bg-[var(--muted)] font-bold text-base">
                <td className="px-4 py-3 text-[var(--foreground)]">Net Cash Change</td>
                <td className={`px-4 py-3 text-right tabular-nums ${(reportData.netCashChange) >= 0 ? "text-green-700" : "text-[var(--destructive)]"}`}>
                  {formatCurrency(reportData.netCashChange)}
                </td>
                {hasComparison && (
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(reportData.comparisonNetCashChange ?? 0)}
                  </td>
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

// ---------------------------------------------------------------------------
// Section sub-component
// ---------------------------------------------------------------------------

function CashFlowSection({
  meta,
  section,
  hasComparison,
}: {
  meta: { label: string; bgClass: string; textClass: string };
  section: CfSection;
  hasComparison: boolean;
}) {
  return (
    <>
      <tr className={meta.bgClass}>
        <td colSpan={hasComparison ? 3 : 2} className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${meta.textClass}`}>
          {meta.label}
        </td>
      </tr>
      {section.rows.map((row, i) => (
        <tr
          key={`${section.section}-${i}`}
          className={`border-b border-[var(--muted)] hover:bg-[var(--muted)]/30 ${row.isSubtotal ? "font-semibold bg-[var(--muted)]/20" : ""}`}
        >
          <td className={`px-4 py-2.5 ${row.isSubtotal ? "" : "pl-8"} text-[var(--foreground)]`}>{row.label}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.amount)}</td>
          {hasComparison && (
            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.comparisonAmount ?? 0)}</td>
          )}
        </tr>
      ))}
      <tr className={`border-b border-[var(--border)] ${meta.bgClass} font-semibold`}>
        <td className={`px-4 py-2 text-right ${meta.textClass}`}>Total {meta.label}</td>
        <td className={`px-4 py-2 text-right tabular-nums ${meta.textClass}`}>{formatCurrency(section.total)}</td>
        {hasComparison && (
          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(section.comparisonTotal ?? 0)}</td>
        )}
      </tr>
    </>
  );
}

export default function CashFlowPage() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <CashFlowContent />
    </Suspense>
  );
}
