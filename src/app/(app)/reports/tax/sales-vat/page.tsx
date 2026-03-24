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

import { useVatRegister } from "@/lib/hooks/use-vat-register";
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

interface VatLine {
  seq: number;
  date: string;
  invoiceNumber: string;
  customerName: string;
  taxId: string;
  branch: string;
  amount: number;
  vat: number;
}

interface VatRegisterData {
  totalSales: number;
  totalOutputVat: number;
  invoiceCount: number;
  customerCount: number;
  lines: VatLine[];
  totalPages?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_CONFIG = { showDepartment: false, showComparison: false };
const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function SalesVatContent() {
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

  const { data, isLoading } = useVatRegister({ period, direction: "REVENUE" });
  const reportData = data as VatRegisterData | undefined;

  const history = useReportHistory({ reportType: "sales-vat" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "sales-vat",
      period,
      scope,
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope]);

  const statCards = useMemo(() => [
    { label: "Total Sales", value: formatCurrency(reportData?.totalSales ?? 0), color: "border-l-[var(--primary)]" },
    { label: "Total Output VAT", value: formatCurrency(reportData?.totalOutputVat ?? 0), color: "border-l-[var(--success)]" },
    { label: "# Invoices", value: String(reportData?.invoiceCount ?? 0), color: "border-l-[var(--secondary)]" },
    { label: "# Customers", value: String(reportData?.customerCount ?? 0), color: "border-l-[var(--warning)]" },
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
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Sales VAT Register</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{"\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e20\u0e32\u0e29\u0e35\u0e02\u0e32\u0e22"} &mdash; Output VAT register for sales</p>
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
          {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      ) : !lines.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No sales VAT data"
          description="There are no sales VAT transactions for the selected period."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] w-12">{"\u0e25\u0e33\u0e14\u0e31\u0e1a\u0e17\u0e35\u0e48"}</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{"\u0e27\u0e31\u0e19\u0e40\u0e14\u0e37\u0e2d\u0e19\u0e1b\u0e35"}</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{"\u0e40\u0e25\u0e02\u0e17\u0e35\u0e48\u0e43\u0e1a\u0e01\u0e33\u0e01\u0e31\u0e1a\u0e20\u0e32\u0e29\u0e35"}</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{"\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e0b\u0e37\u0e49\u0e2d"}</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{"\u0e40\u0e25\u0e02\u0e1b\u0e23\u0e30\u0e08\u0e33\u0e15\u0e31\u0e27\u0e1c\u0e39\u0e49\u0e40\u0e2a\u0e35\u0e22\u0e20\u0e32\u0e29\u0e35"}</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{"\u0e2a\u0e32\u0e02\u0e32"}</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{"\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32"}</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{"\u0e20\u0e32\u0e29\u0e35"}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLines.map((line) => (
                  <tr key={line.seq} className="border-b border-[var(--muted)] hover:bg-[var(--muted)]/30">
                    <td className="px-3 py-2.5 text-center tabular-nums text-[var(--muted-foreground)]">{line.seq}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--muted-foreground)]">{line.date}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--foreground)]">{line.invoiceNumber}</td>
                    <td className="px-3 py-2.5 text-[var(--foreground)]">{line.customerName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{line.taxId}</td>
                    <td className="px-3 py-2.5 text-[var(--muted-foreground)]">{line.branch}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(line.amount)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(line.vat)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-t-[var(--foreground)] bg-[var(--muted)] font-bold">
                  <td colSpan={6} className="px-3 py-3 text-right text-[var(--foreground)]">{"\u0e23\u0e27\u0e21"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(reportData?.totalSales ?? 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(reportData?.totalOutputVat ?? 0)}</td>
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

export default function SalesVatPage() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <SalesVatContent />
    </Suspense>
  );
}
