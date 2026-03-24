"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Download, FileText } from "lucide-react";

import { ReportFilterBar } from "@/components/report-filter-bar";
import { ReportStatCards } from "@/components/report-stat-cards";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ReportHistoryDrawer, type ReportHistoryItem } from "@/components/report-history-drawer";
import { Button } from "@/components/button";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

import { useTaxPp36 } from "@/lib/hooks/use-tax-pp36";
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

interface Pp36Line {
  seq: number;
  vendorName: string;
  country: string;
  description: string;
  amount: number;
  vat: number;
}

interface Pp36Data {
  totalServicesAmount: number;
  vatPayable: number;
  transactionCount: number;
  vendorCount: number;
  lines: Pp36Line[];
  totalPages?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_CONFIG = { showDepartment: false, showComparison: false };
const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function Pp36Content() {
  const [scope, setScope] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [page, setPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const { data, isLoading } = useTaxPp36({ period });
  const reportData = data as Pp36Data | undefined;

  const history = useReportHistory({ reportType: "pp36" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "pp36",
      period,
      scope,
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope]);

  const statCards = useMemo(() => [
    { label: "Total Services Amount", value: formatCurrency(reportData?.totalServicesAmount ?? 0), color: "border-l-[var(--primary)]" },
    { label: "VAT Payable", value: formatCurrency(reportData?.vatPayable ?? 0), color: "border-l-[var(--warning)]" },
    { label: "# Transactions", value: String(reportData?.transactionCount ?? 0), color: "border-l-[var(--secondary)]" },
    { label: "# Vendors", value: String(reportData?.vendorCount ?? 0), color: "border-l-[var(--success)]" },
  ], [reportData]);

  const lines = useMemo(() => reportData?.lines ?? [], [reportData]);

  const paginatedLines = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return lines.slice(start, start + PAGE_SIZE);
  }, [lines, page]);

  const totalPages = reportData?.totalPages ?? Math.ceil(lines.length / PAGE_SIZE) || 1;

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">{"\u0e20.\u0e1e.36"} Non-Resident VAT</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{"\u0e20\u0e32\u0e29\u0e35\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e1c\u0e39\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e16\u0e34\u0e48\u0e19\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48"} &mdash; Non-resident service VAT</p>
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
        lockedScope="monthly"
        onHistoryClick={() => setShowHistory(true)}
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      ) : !lines.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No PP36 data"
          description="There are no non-resident service transactions for the selected period."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] w-12">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Vendor</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Country</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Description</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Amount</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">VAT</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLines.map((line) => (
                  <tr key={line.seq} className="border-b border-[var(--muted)] hover:bg-[var(--muted)]/30">
                    <td className="px-4 py-2.5 text-center tabular-nums text-[var(--muted-foreground)]">{line.seq}</td>
                    <td className="px-4 py-2.5 text-[var(--foreground)]">{line.vendorName}</td>
                    <td className="px-4 py-2.5 text-[var(--muted-foreground)]">{line.country}</td>
                    <td className="px-4 py-2.5 text-[var(--foreground)]">{line.description}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(line.amount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(line.vat)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-t-[var(--foreground)] bg-[var(--muted)] font-bold">
                  <td colSpan={4} className="px-4 py-3 text-right text-[var(--foreground)]">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(reportData?.totalServicesAmount ?? 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(reportData?.vatPayable ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
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

export default function Pp36Page() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <Pp36Content />
    </Suspense>
  );
}
