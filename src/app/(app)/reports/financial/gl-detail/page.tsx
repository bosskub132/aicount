"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Download, FileText } from "lucide-react";

import { ReportFilterBar } from "@/components/report-filter-bar";
import { ReportStatCards } from "@/components/report-stat-cards";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ReportHistoryDrawer, type ReportHistoryItem } from "@/components/report-history-drawer";
import { DataTable, type Column } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { AccountSelect } from "@/components/account-select";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

import { useGlDetail } from "@/lib/hooks/use-gl-detail";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  useReportHistory,
  useLockReport,
  useUnlockReport,
  useDeleteReport,
  useRestoreReport,
} from "@/lib/hooks/use-report-history";
import { useGenerateReportPdf } from "@/lib/hooks/use-report-pdf";
import { formatCurrency, formatDate } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlDetailRow {
  [key: string]: unknown;
  id: string;
  date: string;
  jvNo: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface GlDetailData {
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  transactions: GlDetailRow[];
  totalCount: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const GL_COLUMNS: Column<GlDetailRow>[] = [
  {
    key: "date",
    header: "Date",
    width: "120px",
    render: (row) => formatDate(row.date),
  },
  { key: "jvNo", header: "JV No.", width: "120px" },
  { key: "description", header: "Description" },
  {
    key: "debit",
    header: "Debit",
    align: "right",
    width: "140px",
    render: (row) => (
      <span className="tabular-nums">{row.debit > 0 ? formatCurrency(row.debit) : ""}</span>
    ),
  },
  {
    key: "credit",
    header: "Credit",
    align: "right",
    width: "140px",
    render: (row) => (
      <span className="tabular-nums">{row.credit > 0 ? formatCurrency(row.credit) : ""}</span>
    ),
  },
  {
    key: "runningBalance",
    header: "Balance",
    align: "right",
    width: "140px",
    render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.runningBalance)}</span>,
  },
];

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function GlDetailContent() {
  const [scope, setScope] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [account, setAccount] = useState<string>("");
  const [page, setPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const mounted = useMounted();

  const { data, isLoading: queryLoading } = useGlDetail({
    period,
    scope,
    account,
    page,
    limit: PAGE_SIZE,
  });

  const isLoading = !mounted || queryLoading;

  const reportData = data as GlDetailData | undefined;

  const history = useReportHistory({ reportType: "gl-detail" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "gl-detail",
      period,
      scope,
      filters: { account },
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope, account]);

  const totalPages = useMemo(
    () => Math.ceil((reportData?.totalCount ?? 0) / PAGE_SIZE),
    [reportData],
  );

  const statCards = useMemo(() => [
    { label: "Opening Balance", value: formatCurrency(reportData?.openingBalance ?? 0), color: "border-l-[var(--primary)]" },
    { label: "Total Debits", value: formatCurrency(reportData?.totalDebits ?? 0), color: "border-l-[var(--success)]" },
    { label: "Total Credits", value: formatCurrency(reportData?.totalCredits ?? 0), color: "border-l-[var(--warning)]" },
    { label: "Closing Balance", value: formatCurrency(reportData?.closingBalance ?? 0), color: "border-l-[var(--secondary)]" },
  ], [reportData]);

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  // Placeholder accounts list for the AccountSelect
  const accounts = useMemo(() => [], []);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">GL Detail</h1>
          <p className="text-sm text-[var(--muted-foreground)]">รายละเอียดบัญชีแยกประเภท &mdash; Transaction detail for a single account</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => window.history.back()}>
            All Reports
          </Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!account}>Export</Button>
          <Button icon={<FileText className="h-4 w-4" />} onClick={handleGeneratePdf} loading={generatePdf.isPending} disabled={!account}>
            Generate PDF
          </Button>
        </div>
      </div>

      <ReportStatCards items={statCards} isLoading={isLoading && !!account} />

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3">
        <ReportFilterBar
          config={{}}
          scope={scope}
          onScopeChange={setScope}
          period={period}
          onPeriodChange={setPeriod}
          allowCustomRange
          onHistoryClick={() => setShowHistory(true)}
        />
      </div>

      {/* Account select */}
      <div className="max-w-xs">
        <label className="mb-1 block text-[13px] font-medium text-[var(--card-foreground)]">
          Account <span className="text-[var(--destructive)]">*</span>
        </label>
        <AccountSelect
          value={account || undefined}
          onChange={(code) => { setAccount(code); setPage(1); }}
          accounts={accounts}
          placeholder="Select an account..."
        />
      </div>

      {/* Account not selected */}
      {!account && (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="Select an account"
          description="Choose an account above to view its GL detail."
        />
      )}

      {/* Loading / Empty / Data */}
      {account && isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      )}

      {account && !isLoading && !reportData?.transactions?.length && (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No transactions"
          description="No transactions found for this account in the selected period."
        />
      )}

      {account && !isLoading && reportData && reportData.transactions.length > 0 && (
        <>
          {/* Opening balance banner */}
          <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
            <span className="font-medium text-blue-700">Opening Balance</span>
            <span className="tabular-nums font-bold text-blue-700">{formatCurrency(reportData.openingBalance)}</span>
          </div>

          {/* Data table */}
          <DataTable<GlDetailRow>
            columns={GL_COLUMNS}
            data={reportData.transactions}
            keyField="id"
          />

          {/* Closing balance banner */}
          <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-green-200 bg-green-50 px-4 py-2.5 text-sm">
            <span className="font-medium text-green-700">Closing Balance</span>
            <span className="tabular-nums font-bold text-green-700">{formatCurrency(reportData.closingBalance)}</span>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
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

export default function GlDetailPage() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <GlDetailContent />
    </Suspense>
  );
}
