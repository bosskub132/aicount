"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Download, FileText, ChevronRight, ChevronDown } from "lucide-react";

import { ReportFilterBar } from "@/components/report-filter-bar";
import { ReportStatCards } from "@/components/report-stat-cards";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ReportHistoryDrawer, type ReportHistoryItem } from "@/components/report-history-drawer";
import { DataTable, type Column } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { Select } from "@/components/select";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

import { useJournalListing } from "@/lib/hooks/use-journal-listing";
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

interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface JournalEntryRow {
  id: string;
  jvNo: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  lines: JournalLine[];
  [key: string]: unknown;
}

interface JournalListingData {
  entries: JournalEntryRow[];
  totalEntries: number;
  totalDebit: number;
  totalCredit: number;
  totalCount: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "Manual", label: "Manual" },
  { value: "Auto", label: "Auto" },
  { value: "Adjustment", label: "Adjustment" },
];

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function JournalListingContent() {
  const mounted = useMounted();
  const [scope, setScope] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [journalType, setJournalType] = useState("");
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const { data, isLoading: queryLoading } = useJournalListing({
    period,
    scope,
    type: journalType || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const isLoading = !mounted || queryLoading;
  const reportData = data as JournalListingData | undefined;

  const history = useReportHistory({ reportType: "journal-listing" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "journal-listing",
      period,
      scope,
      filters: { type: journalType },
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope, journalType]);

  const handleToggleExpand = useCallback((rowId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const totalPages = useMemo(
    () => Math.ceil((reportData?.totalCount ?? 0) / PAGE_SIZE),
    [reportData],
  );

  const statCards = useMemo(() => [
    { label: "Total Entries", value: String(reportData?.totalEntries ?? 0), color: "border-l-[var(--primary)]" },
    { label: "Total Debit", value: formatCurrency(reportData?.totalDebit ?? 0), color: "border-l-[var(--success)]" },
    { label: "Total Credit", value: formatCurrency(reportData?.totalCredit ?? 0), color: "border-l-[var(--warning)]" },
    { label: "Period", value: period, color: "border-l-[var(--secondary)]" },
  ], [reportData, period]);

  const columns: Column<JournalEntryRow>[] = useMemo(() => [
    {
      key: "expand",
      header: "",
      width: "40px",
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleToggleExpand(row.id); }}
          className="p-1 rounded hover:bg-[var(--muted)] cursor-pointer"
          aria-label={expandedIds.has(row.id) ? "Collapse" : "Expand"}
        >
          {expandedIds.has(row.id) ? (
            <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
          )}
        </button>
      ),
    },
    { key: "jvNo", header: "JV No.", width: "120px" },
    {
      key: "date",
      header: "Date",
      width: "120px",
      render: (row) => formatDate(row.date),
    },
    { key: "description", header: "Description" },
    {
      key: "amount",
      header: "Amount",
      align: "right" as const,
      width: "140px",
      render: (row) => <span className="tabular-nums">{formatCurrency(row.amount)}</span>,
    },
    { key: "type", header: "Type", width: "100px" },
  ], [expandedIds, handleToggleExpand]);

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  const renderExpandedRow = useCallback((row: JournalEntryRow) => {
    const entry = row as JournalEntryRow;
    if (!entry.lines?.length) return <p className="text-sm text-[var(--muted-foreground)]">No lines</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--muted-foreground)]">
              <th className="px-3 py-1.5 text-left font-medium">Account Code</th>
              <th className="px-3 py-1.5 text-left font-medium">Account Name</th>
              <th className="px-3 py-1.5 text-right font-medium">Debit</th>
              <th className="px-3 py-1.5 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line, i) => (
              <tr key={i} className="border-t border-[var(--muted)]">
                <td className="px-3 py-1.5 font-mono">{line.accountCode}</td>
                <td className="px-3 py-1.5">{line.accountName}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{line.debit > 0 ? formatCurrency(line.debit) : ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{line.credit > 0 ? formatCurrency(line.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, []);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Journal Listing</h1>
          <p className="text-sm text-[var(--muted-foreground)]">รายการสมุดรายวัน &mdash; All journal entries for the period</p>
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

      {/* Filters */}
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

      {/* Journal type filter */}
      <div className="max-w-[200px]">
        <Select
          label="Journal Type"
          options={TYPE_OPTIONS}
          value={journalType}
          onChange={(val) => { setJournalType(val); setPage(1); }}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      ) : !reportData?.entries?.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No journal entries"
          description="No journal entries found for the selected period and filters."
        />
      ) : (
        <>
          <DataTable<JournalEntryRow>
            columns={columns}
            data={reportData.entries}
            keyField="id"
            expandedRow={renderExpandedRow}
            expandedRowIds={expandedIds}
            onToggleExpand={handleToggleExpand}
            onRowClick={(row) => handleToggleExpand(row.id)}
          />

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

export default function JournalListingPage() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <JournalListingContent />
    </Suspense>
  );
}
