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

import { useTrialBalance } from "@/lib/hooks/use-trial-balance";
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

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  category: string;
  debit: number;
  credit: number;
}

interface TrialBalanceData {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  accountCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_CONFIG = { showDepartment: true };

const CATEGORY_ORDER = ["Asset", "Liability", "Equity", "Revenue", "Expense"];

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function TrialBalanceContent() {
  const [scope, setScope] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [department, setDepartment] = useState("all");
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const { data, isLoading } = useTrialBalance({
    period,
    scope,
    department: department !== "all" ? department : undefined,
  });

  const reportData = data as TrialBalanceData | undefined;

  const history = useReportHistory({ reportType: "trial-balance" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "trial-balance",
      period,
      scope,
      filters: { department },
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope, department]);

  const imbalance = useMemo(() => {
    if (!reportData) return 0;
    return Math.abs(reportData.totalDebit - reportData.totalCredit);
  }, [reportData]);

  const statCards = useMemo(() => [
    { label: "Total Debits", value: formatCurrency(reportData?.totalDebit ?? 0), color: "border-l-[var(--primary)]" },
    { label: "Total Credits", value: formatCurrency(reportData?.totalCredit ?? 0), color: "border-l-[var(--success)]" },
    { label: "# Accounts", value: String(reportData?.accountCount ?? 0), color: "border-l-[var(--warning)]" },
    {
      label: "Imbalance",
      value: formatCurrency(imbalance),
      color: imbalance === 0 ? "border-l-[var(--success)]" : "border-l-[var(--destructive)]",
    },
  ], [reportData, imbalance]);

  // Group rows by category
  const groupedRows = useMemo(() => {
    if (!reportData?.rows) return [];
    const groups: { category: string; rows: TrialBalanceRow[]; subtotalDebit: number; subtotalCredit: number }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const catRows = reportData.rows.filter((r) => r.category === cat);
      if (catRows.length > 0) {
        groups.push({
          category: cat,
          rows: catRows,
          subtotalDebit: catRows.reduce((sum, r) => sum + r.debit, 0),
          subtotalCredit: catRows.reduce((sum, r) => sum + r.credit, 0),
        });
      }
    }
    return groups;
  }, [reportData]);

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Trial Balance</h1>
          <p className="text-sm text-[var(--muted-foreground)]">งบทดลอง &mdash; Debit and credit totals by account</p>
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

      {/* Stat Cards */}
      <ReportStatCards items={statCards} isLoading={isLoading} />

      {/* Filters */}
      <ReportFilterBar
        config={FILTER_CONFIG}
        scope={scope}
        onScopeChange={setScope}
        period={period}
        onPeriodChange={setPeriod}
        department={department}
        onDepartmentChange={setDepartment}
        onHistoryClick={() => setShowHistory(true)}
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="rect" height="40px" />
          ))}
        </div>
      ) : !reportData?.rows?.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No trial balance data"
          description="There are no journal entries for the selected period."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Account Code
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Account Name
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Debit
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((group) => (
                <GroupSection key={group.category} group={group} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--foreground)] bg-[var(--muted)] font-bold">
                <td colSpan={2} className="px-4 py-3 text-[var(--foreground)]">Grand Total</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground)]">
                  {formatCurrency(reportData.totalDebit)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground)]">
                  {formatCurrency(reportData.totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* PDF Preview Modal */}
      <PdfPreviewModal isOpen={showPdfPreview} onClose={() => setShowPdfPreview(false)} pdfUrl={pdfUrl} />

      {/* History Drawer */}
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
// Group Section sub-component
// ---------------------------------------------------------------------------

function GroupSection({
  group,
}: {
  group: { category: string; rows: TrialBalanceRow[]; subtotalDebit: number; subtotalCredit: number };
}) {
  return (
    <>
      <tr className="bg-[var(--muted)]/60">
        <td colSpan={4} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
          {group.category}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.accountCode} className="border-b border-[var(--muted)] hover:bg-[var(--muted)]/30">
          <td className="px-4 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{row.accountCode}</td>
          <td className="px-4 py-2.5 text-[var(--foreground)]">{row.accountName}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{row.debit > 0 ? formatCurrency(row.debit) : ""}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{row.credit > 0 ? formatCurrency(row.credit) : ""}</td>
        </tr>
      ))}
      <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
        <td colSpan={2} className="px-4 py-2 text-right text-xs font-semibold text-[var(--muted-foreground)]">
          Subtotal — {group.category}
        </td>
        <td className="px-4 py-2 text-right tabular-nums font-semibold">
          {group.subtotalDebit > 0 ? formatCurrency(group.subtotalDebit) : ""}
        </td>
        <td className="px-4 py-2 text-right tabular-nums font-semibold">
          {group.subtotalCredit > 0 ? formatCurrency(group.subtotalCredit) : ""}
        </td>
      </tr>
    </>
  );
}

// ---------------------------------------------------------------------------
// Default export with Suspense
// ---------------------------------------------------------------------------

export default function TrialBalancePage() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <TrialBalanceContent />
    </Suspense>
  );
}
