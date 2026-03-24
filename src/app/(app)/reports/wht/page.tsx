"use client";

import {
  Suspense,
  startTransition,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  FileText,
  Download,
  Search,
  Ban,
  Plus,
  CheckSquare,
} from "lucide-react";

import { Tabs } from "@/components/tabs";
import { DataTable, type Column } from "@/components/data-table";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ReportStatCards } from "@/components/report-stat-cards";
import { PeriodPicker } from "@/components/period-picker";
import { Checkbox } from "@/components/checkbox";

import {
  useWhtCertificates,
  useWhtCertificateStats,
  useGenerateWhtCertificate,
  useVoidWhtCertificate,
  useBatchGenerateWht,
} from "@/lib/hooks/use-wht-certificates";
import { useWhtUncertified } from "@/lib/hooks/use-wht-uncertified";
import { useToast } from "@/lib/stores/ui-store";
import { formatCurrency, formatDate } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhtCertificateRow {
  id: string;
  certificateNo: string;
  issuedAt: string;
  payeeName: string;
  payeeTaxId: string;
  payeeBranch: string;
  incomeType: string;
  amountPaid: number;
  whtRate: number;
  whtAmount: number;
  formType: string;
  status: string;
  pdfUrl?: string;
  [key: string]: unknown;
}

interface UncertifiedDocRow {
  id: string;
  documentNo: string;
  date: string;
  vendorName: string;
  vendorTaxId: string;
  type: string;
  incomeType: string;
  amount: number;
  whtRate: number;
  whtAmount: number;
  formType: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAB_ITEMS = [
  { label: "Certificate Log", value: "log" },
  { label: "Bulk Generate", value: "bulk" },
];

const STATUS_PILLS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Voided", value: "voided" },
];

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Sub-components: Void Modal
// ---------------------------------------------------------------------------

function VoidConfirmModal({
  certNo,
  open,
  onClose,
  onConfirm,
  isPending,
}: {
  certNo: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");

  const handleConfirm = useCallback(() => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  }, [reason, onConfirm]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Void Certificate ${certNo}?`}
      actions={
        <div className="flex items-center gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            loading={isPending}
            disabled={!reason.trim()}
          >
            Void Certificate
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted-foreground)]">
          This action cannot be undone. The certificate will be marked as voided
          and a replacement may need to be issued.
        </p>
        <div>
          <label className="text-[13px] font-medium text-[var(--card-foreground)] mb-1 block">
            Reason for voiding <span className="text-[var(--destructive)]">*</span>
          </label>
          <textarea
            className="w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
            rows={3}
            placeholder="Enter reason for voiding this certificate..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-components: Single Generate Modal
// ---------------------------------------------------------------------------

function SingleGenerateModal({
  open,
  onClose,
  onGenerate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onGenerate: (documentId: string) => void;
  isPending: boolean;
}) {
  const [documentId, setDocumentId] = useState("");

  const handleGenerate = useCallback(() => {
    if (!documentId.trim()) return;
    onGenerate(documentId.trim());
  }, [documentId, onGenerate]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate WHT Certificate"
      actions={
        <div className="flex items-center gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            loading={isPending}
            disabled={!documentId.trim()}
            icon={<FileText className="h-4 w-4" />}
          >
            Generate
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted-foreground)]">
          Enter the document ID to generate a WHT certificate from.
        </p>
        <Input
          label="Document ID"
          required
          placeholder="Enter document ID..."
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-components: Batch Confirm Modal
// ---------------------------------------------------------------------------

function BatchConfirmModal({
  count,
  open,
  onClose,
  onConfirm,
  isPending,
}: {
  count: number;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Batch Generation"
      actions={
        <div className="flex items-center gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            loading={isPending}
            icon={<CheckSquare className="h-4 w-4" />}
          >
            Generate {count} Certificates
          </Button>
        </div>
      }
    >
      <p className="text-sm text-[var(--muted-foreground)]">
        This will generate <strong>{count}</strong> WHT certificate
        {count !== 1 ? "s" : ""} for the selected documents. Continue?
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Certificate Log
// ---------------------------------------------------------------------------

function CertificateLogTab({
  period,
  onPeriodChange,
}: {
  period: string;
  onPeriodChange: (p: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [voidTarget, setVoidTarget] = useState<WhtCertificateRow | null>(null);

  const { data, isLoading } = useWhtCertificates({
    period,
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const { data: stats, isLoading: statsLoading } = useWhtCertificateStats({
    period,
  });

  const voidCert = useVoidWhtCertificate();

  const certificates: WhtCertificateRow[] = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  const statCards = useMemo(
    () => [
      {
        label: "Total Certificates",
        value: String(stats?.totalCount ?? 0),
        color: "border-l-[var(--primary)]",
      },
      {
        label: "Total WHT Amount",
        value: formatCurrency(stats?.totalWhtAmount ?? 0),
        color: "border-l-[var(--success)]",
      },
      {
        label: "Active",
        value: String(stats?.activeCount ?? 0),
        color: "border-l-[var(--success)]",
      },
      {
        label: "Voided",
        value: String(stats?.voidedCount ?? 0),
        color: "border-l-[var(--destructive)]",
      },
    ],
    [stats],
  );

  const columns: Column<WhtCertificateRow>[] = useMemo(
    () => [
      {
        key: "certificateNo",
        header: "Certificate No.",
        render: (row) => (
          <button
            className="text-[var(--primary)] hover:underline cursor-pointer text-left"
            onClick={(e) => {
              e.stopPropagation();
              setPdfPreviewUrl(row.pdfUrl ?? null);
              setShowPdfPreview(true);
            }}
          >
            {row.certificateNo}
          </button>
        ),
      },
      {
        key: "issuedAt",
        header: "Date Issued",
        render: (row) => formatDate(row.issuedAt),
      },
      { key: "payeeName", header: "Payee" },
      { key: "payeeTaxId", header: "Tax ID" },
      { key: "payeeBranch", header: "Branch" },
      { key: "incomeType", header: "Income Type" },
      {
        key: "amountPaid",
        header: "Amount Paid",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">{formatCurrency(row.amountPaid)}</span>
        ),
      },
      {
        key: "whtRate",
        header: "WHT Rate",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">{row.whtRate}%</span>
        ),
      },
      {
        key: "whtAmount",
        header: "WHT Amount",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">{formatCurrency(row.whtAmount)}</span>
        ),
      },
      {
        key: "formType",
        header: "Form",
        align: "center",
        render: (row) => <Badge>{row.formType}</Badge>,
      },
      {
        key: "status",
        header: "Status",
        align: "center",
        render: (row) => {
          const isActive = (row.status || "").toLowerCase() !== "voided";
          return (
            <Badge variant={isActive ? "approved" : "void"}>
              {isActive ? "Active" : "Voided"}
            </Badge>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        align: "center",
        render: (row) => {
          const isActive = (row.status || "").toLowerCase() !== "voided";
          return (
            <div className="flex items-center justify-center gap-1">
              {row.pdfUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(row.pdfUrl, "_blank");
                  }}
                />
              )}
              {isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Ban className="h-3.5 w-3.5 text-[var(--destructive)]" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setVoidTarget(row);
                  }}
                />
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  const handleVoid = useCallback(
    (reason: string) => {
      if (!voidTarget) return;
      voidCert.mutate(
        { certId: voidTarget.id, reason },
        {
          onSuccess: () => setVoidTarget(null),
        },
      );
    },
    [voidTarget, voidCert],
  );

  const handleRowClick = useCallback((row: WhtCertificateRow) => {
    setPdfPreviewUrl(row.pdfUrl ?? null);
    setShowPdfPreview(true);
  }, []);

  return (
    <div className="space-y-5">
      <ReportStatCards items={statCards} isLoading={statsLoading} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker
          scope="monthly"
          onScopeChange={() => {}}
          period={period}
          onPeriodChange={onPeriodChange}
          lockedScope="monthly"
        />
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            className="h-9 w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            placeholder="Search cert no, vendor, tax ID..."
            value={search}
            onChange={(e) => {
              startTransition(() => {
                setSearch(e.target.value);
                setPage(1);
              });
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.value}
              onClick={() =>
                startTransition(() => {
                  setStatusFilter(pill.value);
                  setPage(1);
                })
              }
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === pill.value
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} variant="rect" height="40px" />
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No WHT certificates"
          description="No certificates found for the selected period and filters."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={certificates}
            onRowClick={handleRowClick}
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

      {/* Void Modal */}
      {voidTarget && (
        <VoidConfirmModal
          certNo={voidTarget.certificateNo}
          open={!!voidTarget}
          onClose={() => setVoidTarget(null)}
          onConfirm={handleVoid}
          isPending={voidCert.isPending}
        />
      )}

      {/* PDF Preview */}
      <PdfPreviewModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        pdfUrl={pdfPreviewUrl}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Bulk Generate
// ---------------------------------------------------------------------------

function BulkGenerateTab({
  period,
  onPeriodChange,
  onSwitchToLog,
}: {
  period: string;
  onPeriodChange: (p: string) => void;
  onSwitchToLog: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading } = useWhtUncertified({ period });
  const batchGenerate = useBatchGenerateWht();
  const toast = useToast();

  const documents: UncertifiedDocRow[] = useMemo(() => data?.items ?? [], [data?.items]);

  const allSelected =
    documents.length > 0 && selectedIds.size === documents.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < documents.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  }, [allSelected, documents]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedTotal = useMemo(
    () =>
      documents
        .filter((d) => selectedIds.has(d.id))
        .reduce((sum, d) => sum + (d.whtAmount ?? 0), 0),
    [documents, selectedIds],
  );

  const handleBatchGenerate = useCallback(() => {
    const ids = Array.from(selectedIds);
    batchGenerate.mutate(
      { documentIds: ids },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setShowConfirm(false);
          toast.success(
            `Generated ${ids.length} WHT certificate${ids.length !== 1 ? "s" : ""}`,
          );
          startTransition(() => {
            onSwitchToLog();
          });
        },
        onSettled: () => {
          setShowConfirm(false);
        },
      },
    );
  }, [selectedIds, batchGenerate, toast, onSwitchToLog]);

  const columns: Column<UncertifiedDocRow>[] = useMemo(
    () => [
      {
        key: "select",
        header: "",
        width: "40px",
        render: (row) => (
          <Checkbox
            checked={selectedIds.has(row.id)}
            onChange={() => toggleOne(row.id)}
          />
        ),
      },
      { key: "documentNo", header: "Document No." },
      {
        key: "date",
        header: "Date",
        render: (row) => formatDate(row.date),
      },
      { key: "vendorName", header: "Vendor" },
      { key: "vendorTaxId", header: "Tax ID" },
      {
        key: "type",
        header: "Type",
        align: "center",
        render: (row) => <Badge>{row.type}</Badge>,
      },
      { key: "incomeType", header: "Income Type" },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">{formatCurrency(row.amount)}</span>
        ),
      },
      {
        key: "whtRate",
        header: "WHT Rate",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">{row.whtRate}%</span>
        ),
      },
      {
        key: "whtAmount",
        header: "WHT Amount",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">{formatCurrency(row.whtAmount)}</span>
        ),
      },
      {
        key: "formType",
        header: "Form",
        align: "center",
        render: (row) => <Badge>{row.formType}</Badge>,
      },
    ],
    [selectedIds, toggleOne],
  );

  return (
    <div className="space-y-5">
      {/* Period picker */}
      <PeriodPicker
        scope="monthly"
        onScopeChange={() => {}}
        period={period}
        onPeriodChange={(p) => {
          onPeriodChange(p);
          setSelectedIds(new Set());
        }}
        lockedScope="monthly"
      />

      {/* Select-all header */}
      {documents.length > 0 && (
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleAll}
            label={allSelected ? "Deselect all" : "Select all"}
          />
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="rect" height="40px" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No uncertified documents"
          description="All documents for this period already have WHT certificates, or there are no applicable documents."
        />
      ) : (
        <DataTable columns={columns} data={documents} />
      )}

      {/* Summary bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
          <p className="text-sm text-[var(--foreground)]">
            Selected: <strong>{selectedIds.size}</strong> &middot; Total WHT:{" "}
            <strong className="tabular-nums">
              {formatCurrency(selectedTotal)}
            </strong>
          </p>
          <Button
            icon={<CheckSquare className="h-4 w-4" />}
            onClick={() => setShowConfirm(true)}
          >
            Generate Selected
          </Button>
        </div>
      )}

      {/* Confirm modal */}
      <BatchConfirmModal
        count={selectedIds.size}
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleBatchGenerate}
        isPending={batchGenerate.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function WhtCertificatesContent() {
  const [activeTab, setActiveTab] = useState("log");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showGenerate, setShowGenerate] = useState(false);

  const generateCert = useGenerateWhtCertificate();

  const handleSingleGenerate = useCallback(
    (documentId: string) => {
      generateCert.mutate(
        { documentId },
        {
          onSuccess: () => setShowGenerate(false),
        },
      );
    },
    [generateCert],
  );

  const handleSwitchToLog = useCallback(() => {
    setActiveTab("log");
  }, []);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            WHT Certificates
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            หนังสือรับรองการหักภาษี ณ ที่จ่าย
          </p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowGenerate(true)}
        >
          Generate Certificate
        </Button>
      </div>

      {/* Tabs */}
      <Tabs tabs={TAB_ITEMS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === "log" ? (
        <CertificateLogTab period={period} onPeriodChange={setPeriod} />
      ) : (
        <BulkGenerateTab
          period={period}
          onPeriodChange={setPeriod}
          onSwitchToLog={handleSwitchToLog}
        />
      )}

      {/* Single Generate Modal */}
      <SingleGenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerate={handleSingleGenerate}
        isPending={generateCert.isPending}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Default Export with Suspense
// ---------------------------------------------------------------------------

export default function WhtCertificatesPage() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <WhtCertificatesContent />
    </Suspense>
  );
}
