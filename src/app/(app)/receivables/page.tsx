"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Download,
  Search,
  Calendar,
  ChevronRight,
  FileText,
  CreditCard,
} from "lucide-react";

import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AgingMiniBar } from "@/components/aging-mini-bar";
import { CurrencyInput } from "@/components/currency-input";
import {
  getWorkspaceTenantId,
  isDefaultWorkspaceTenantId,
} from "@/components/workspace-selector";
import { useReceivables } from "@/lib/hooks/use-receivables";
import { useRecordPayment } from "@/lib/hooks/use-payments";
import { useToast } from "@/lib/stores/ui-store";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { exportToCsv } from "@/lib/utils/csv-export";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceRow {
  id: string;
  invoiceNo: string;
  date: string;
  dueDate: string;
  amount: number;
  paid: number;
  remaining: number;
  status: string;
  overdueDays: number;
  sourceDocId?: string;
  sourceDocNo?: string;
}

interface CustomerAgingRow {
  [key: string]: unknown;
  id: string;
  customerId: string;
  customerName: string;
  taxId: string;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  overdue: number;
  total: number;
  invoices: InvoiceRow[];
}

interface ReceivablesSummary {
  totalOutstanding: number;
  totalOutstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  collectedThisMonth: number;
  collectedLastMonth: number;
  avgCollectionDays: number;
  avgCreditTerms: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Overdue", value: "overdue" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
];

const PAYMENT_METHOD_OPTIONS = [
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Cheque", value: "cheque" },
  { label: "Cash", value: "cash" },
  { label: "PromptPay", value: "promptpay" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function agingCellClass(bucket: "current" | "d30" | "d60" | "d90" | "overdue"): string {
  if (bucket === "d60") return "text-[var(--aging-60)] font-semibold";
  if (bucket === "d90") return "text-[var(--aging-90)] font-semibold";
  if (bucket === "overdue") return "text-[var(--aging-overdue)] font-semibold";
  return "text-[var(--foreground)]";
}

function renderAmount(value: number, className: string = ""): React.ReactNode {
  if (value === 0) {
    return <span className="text-[var(--muted-foreground)]">&mdash;</span>;
  }
  return <span className={`tabular-nums ${className}`}>{formatCurrency(value)}</span>;
}

function invoiceStatusBadge(status: string, overdueDays: number): React.ReactNode {
  const s = status.toLowerCase();
  if (s === "paid") return <Badge variant="approved">Paid</Badge>;
  if (s === "partial") return <Badge variant="processing">Partial</Badge>;
  if (s === "overdue") {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-button)] px-2.5 py-0.5 text-xs font-medium bg-[var(--destructive-light)] text-[var(--destructive)]">
        Overdue {overdueDays}d
      </span>
    );
  }
  return <Badge variant="approved">Open</Badge>;
}

function dueDateClass(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "text-[var(--destructive)] font-semibold";
  if (diff <= 7) return "text-[var(--aging-60)]";
  return "text-[var(--foreground)]";
}

function collectedTrend(current: number, last: number): { pct: string; direction: "up" | "down" | "neutral" } {
  if (last === 0) return { pct: "N/A", direction: "neutral" };
  const change = ((current - last) / last) * 100;
  return {
    pct: `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`,
    direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}

// ---------------------------------------------------------------------------
// Main page export (Suspense wrapper for useSearchParams)
// ---------------------------------------------------------------------------

export default function ReceivablesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-28 w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
          <Skeleton variant="rect" className="h-96 w-full rounded-[var(--radius-card)]" />
        </div>
      }
    >
      <ReceivablesPageContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

function ReceivablesPageContent() {
  const toast = useToast();
  const tenantId = getWorkspaceTenantId();
  const isDefault = isDefaultWorkspaceTenantId(tenantId);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState("");

  // Expanded rows
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRow | null>(null);
  const [paymentCustomerName, setPaymentCustomerName] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number | undefined>(undefined);
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Debounce search and reset page
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== search) {
          setPage(1);
        }
        return search;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change via handlers
  const handleStatusFilterChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
  }, []);

  const handleDateFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFrom(e.target.value);
    setPage(1);
  }, []);

  const handleDateToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDateTo(e.target.value);
    setPage(1);
  }, []);

  // Data fetching
  const { data, isLoading, isError } = useReceivables(tenantId, {
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });

  const recordPaymentMutation = useRecordPayment(tenantId);

  // Derived data
  const summary: ReceivablesSummary = useMemo(() => {
    if (!data?.data?.summary) {
      return {
        totalOutstanding: 0,
        totalOutstandingCount: 0,
        overdueAmount: 0,
        overdueCount: 0,
        collectedThisMonth: 0,
        collectedLastMonth: 0,
        avgCollectionDays: 0,
        avgCreditTerms: 30,
      };
    }
    return data.data.summary as ReceivablesSummary;
  }, [data]);

  const customers: CustomerAgingRow[] = useMemo(() => {
    if (!data?.data?.customers) return [];
    return data.data.customers as CustomerAgingRow[];
  }, [data]);

  const totalPages = useMemo(() => {
    if (!data?.data?.pagination) return 1;
    return Math.ceil((data.data.pagination.total || 0) / (data.data.pagination.limit || 20));
  }, [data]);

  // Column totals
  const columnTotals = useMemo(() => {
    return customers.reduce(
      (acc, c) => ({
        current: acc.current + c.current,
        d30: acc.d30 + c.d30,
        d60: acc.d60 + c.d60,
        d90: acc.d90 + c.d90,
        overdue: acc.overdue + c.overdue,
        total: acc.total + c.total,
      }),
      { current: 0, d30: 0, d60: 0, d90: 0, overdue: 0, total: 0 },
    );
  }, [customers]);

  // Handlers
  const handleToggleExpand = useCallback((rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const openPaymentModal = useCallback((invoice: InvoiceRow, customerName: string) => {
    setPaymentInvoice(invoice);
    setPaymentCustomerName(customerName);
    setPaymentAmount(invoice.remaining);
    setPaymentDate(todayISO());
    setPaymentMethod("bank_transfer");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentModalOpen(true);
  }, []);

  const closePaymentModal = useCallback(() => {
    setPaymentModalOpen(false);
    setPaymentInvoice(null);
  }, []);

  const handleRecordPayment = useCallback(() => {
    if (!paymentInvoice || !paymentAmount) {
      toast.error("Please enter a payment amount");
      return;
    }
    if (paymentAmount <= 0) {
      toast.error("Payment amount must be greater than 0");
      return;
    }
    if (paymentAmount > paymentInvoice.remaining) {
      toast.error("Payment amount cannot exceed remaining balance");
      return;
    }

    recordPaymentMutation.mutate(
      {
        type: "receivable",
        invoiceId: paymentInvoice.id,
        amount: paymentAmount,
        paymentDate,
        paymentMethod,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
      },
      {
        onSuccess: () => {
          closePaymentModal();
        },
      },
    );
  }, [
    paymentInvoice,
    paymentAmount,
    paymentDate,
    paymentMethod,
    paymentReference,
    paymentNotes,
    recordPaymentMutation,
    closePaymentModal,
    toast,
  ]);

  const handleExport = useCallback(() => {
    if (customers.length === 0) {
      toast.error("No data to export");
      return;
    }
    const csvColumns = [
      "Customer",
      "Tax ID",
      "Current",
      "1-30 Days",
      "31-60 Days",
      "61-90 Days",
      "90+ Days",
      "Total",
    ];
    const rows = customers.map((c) => [
      c.customerName,
      c.taxId,
      String(c.current),
      String(c.d30),
      String(c.d60),
      String(c.d90),
      String(c.overdue),
      String(c.total),
    ]);
    exportToCsv(csvColumns, rows, "accounts-receivable-aging");
  }, [customers, toast]);

  // Table columns
  const columns: Column<CustomerAgingRow>[] = useMemo(
    () => [
      {
        key: "customerName",
        header: "Customer",
        width: "28%",
        render: (row) => (
          <div>
            <div className="font-semibold text-[var(--foreground)] text-[13px]">
              {row.customerName}
            </div>
            {row.taxId && (
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono">
                Tax ID: {row.taxId}
              </div>
            )}
            {expandedRowIds.has(row.id) && (
              <AgingMiniBar
                buckets={{
                  current: row.current,
                  d30: row.d30,
                  d60: row.d60,
                  d90: row.d90,
                  overdue: row.overdue,
                }}
                className="mt-1.5 w-36"
              />
            )}
          </div>
        ),
      },
      {
        key: "current",
        header: "Current",
        align: "right" as const,
        width: "10%",
        render: (row) => renderAmount(row.current, agingCellClass("current")),
      },
      {
        key: "d30",
        header: "1\u201330 d",
        align: "right" as const,
        width: "10%",
        render: (row) => renderAmount(row.d30, agingCellClass("d30")),
      },
      {
        key: "d60",
        header: "31\u201360 d",
        align: "right" as const,
        width: "10%",
        render: (row) => renderAmount(row.d60, agingCellClass("d60")),
      },
      {
        key: "d90",
        header: "61\u201390 d",
        align: "right" as const,
        width: "10%",
        render: (row) => renderAmount(row.d90, agingCellClass("d90")),
      },
      {
        key: "overdue",
        header: "90+ d",
        align: "right" as const,
        width: "10%",
        render: (row) => renderAmount(row.overdue, agingCellClass("overdue")),
      },
      {
        key: "total",
        header: "Total",
        align: "right" as const,
        width: "12%",
        render: (row) => (
          <span className="tabular-nums font-bold text-[var(--foreground)]">
            {formatCurrency(row.total)}
          </span>
        ),
      },
      {
        key: "_expand",
        header: "",
        align: "center" as const,
        width: "4%",
        render: (row) => (
          <ChevronRight
            className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-150 ${
              expandedRowIds.has(row.id) ? "rotate-90 text-[var(--primary)]" : ""
            }`}
          />
        ),
      },
    ],
    [expandedRowIds],
  );

  // Expanded row render
  const renderExpandedRow = useCallback(
    (row: CustomerAgingRow) => (
      <div className="px-1 pb-2">
        <table className="w-full border-collapse bg-white rounded-lg border border-[var(--border)] overflow-hidden text-sm">
          <thead>
            <tr className="bg-[var(--muted)]">
              <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Invoice
              </th>
              <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Date
              </th>
              <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Due Date
              </th>
              <th className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Amount
              </th>
              <th className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Paid
              </th>
              <th className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Remaining
              </th>
              <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Status
              </th>
              <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Source
              </th>
              <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]" style={{ width: 120 }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {(row.invoices || []).length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3.5 py-6 text-center text-[var(--muted-foreground)]">
                  No invoices found
                </td>
              </tr>
            ) : (
              row.invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--muted)] last:border-b-0">
                  <td className="px-3.5 py-3 font-mono font-medium text-[13px]">
                    {inv.invoiceNo}
                  </td>
                  <td className="px-3.5 py-3 text-[13px]">{formatDate(inv.date)}</td>
                  <td className={`px-3.5 py-3 text-[13px] ${dueDateClass(inv.dueDate)}`}>
                    {formatDate(inv.dueDate)}
                  </td>
                  <td className="px-3.5 py-3 text-right tabular-nums text-[13px]">
                    {formatCurrency(inv.amount)}
                  </td>
                  <td className="px-3.5 py-3 text-right tabular-nums text-[13px]">
                    {inv.paid > 0 ? (
                      <span className="text-[var(--success)] font-medium">
                        {formatCurrency(inv.paid)}
                      </span>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">0.00</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-right tabular-nums text-[13px]">
                    {inv.remaining > 0 && inv.overdueDays > 0 ? (
                      <span className="text-[var(--destructive)] font-semibold">
                        {formatCurrency(inv.remaining)}
                      </span>
                    ) : (
                      <span className="font-semibold">{formatCurrency(inv.remaining)}</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    {invoiceStatusBadge(inv.status, inv.overdueDays)}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    {inv.sourceDocNo ? (
                      <a
                        href={`/documents/${inv.sourceDocId}`}
                        className="text-xs font-medium text-[var(--primary)] hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {inv.sourceDocNo}
                      </a>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    {inv.status.toLowerCase() !== "paid" && (
                      <Button
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          openPaymentModal(inv, row.customerName);
                        }}
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1" />
                        Record Payment
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    ),
    [openPaymentModal],
  );

  // Footer
  const customerCount = customers.length;
  const tableFooter = (
    <tr className="bg-[var(--muted)] border-t-2 border-[var(--border)]">
      <td className="px-4 py-3.5 font-bold text-[var(--foreground)]">
        Total ({customerCount} customers)
      </td>
      <td className="px-4 py-3.5 text-right tabular-nums text-[var(--foreground)]">
        {renderAmount(columnTotals.current)}
      </td>
      <td className="px-4 py-3.5 text-right tabular-nums text-[var(--foreground)]">
        {renderAmount(columnTotals.d30)}
      </td>
      <td className="px-4 py-3.5 text-right tabular-nums">
        {renderAmount(columnTotals.d60, agingCellClass("d60"))}
      </td>
      <td className="px-4 py-3.5 text-right tabular-nums">
        {renderAmount(columnTotals.d90, agingCellClass("d90"))}
      </td>
      <td className="px-4 py-3.5 text-right tabular-nums">
        {renderAmount(columnTotals.overdue, agingCellClass("overdue"))}
      </td>
      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[var(--foreground)] text-[15px]">
        {formatCurrency(columnTotals.total)}
      </td>
      <td />
    </tr>
  );

  // Trend for collected
  const collectedTrendInfo = useMemo(
    () => collectedTrend(summary.collectedThisMonth, summary.collectedLastMonth),
    [summary.collectedThisMonth, summary.collectedLastMonth],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isDefault) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No workspace selected"
          description="Select a workspace to view accounts receivable."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--foreground)]">
            Accounts Receivable
          </h1>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">
            ลูกหนี้การค้า — Customer invoices &amp; aging analysis
          </p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1.5" />
          Export
        </Button>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-28 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Outstanding */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Total Outstanding
            </p>
            <p className="mt-2 text-[26px] font-bold text-[var(--foreground)] tabular-nums">
              ฿{formatCurrency(summary.totalOutstanding)}
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              {summary.totalOutstandingCount} open invoices
            </p>
          </div>

          {/* Overdue */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 border-l-[3px] border-l-[var(--destructive)]">
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Overdue
            </p>
            <p className="mt-2 text-[26px] font-bold text-[var(--destructive)] tabular-nums">
              ฿{formatCurrency(summary.overdueAmount)}
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              {summary.overdueCount} invoices past due
            </p>
          </div>

          {/* Collected This Month */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 border-l-[3px] border-l-[var(--success)]">
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Collected This Month
            </p>
            <p className="mt-2 text-[26px] font-bold text-[var(--success)] tabular-nums">
              ฿{formatCurrency(summary.collectedThisMonth)}
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)] flex items-center gap-1">
              <span
                className={
                  collectedTrendInfo.direction === "up"
                    ? "text-[var(--success)]"
                    : collectedTrendInfo.direction === "down"
                      ? "text-[var(--destructive)]"
                      : "text-[var(--muted-foreground)]"
                }
              >
                {collectedTrendInfo.direction === "up" ? "\u2191" : collectedTrendInfo.direction === "down" ? "\u2193" : ""}{" "}
                {collectedTrendInfo.pct}
              </span>{" "}
              vs last month
            </p>
          </div>

          {/* Avg Collection Days */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Avg Collection Days
            </p>
            <p className="mt-2 text-[26px] font-bold text-[var(--foreground)] tabular-nums">
              {summary.avgCollectionDays}
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)] flex items-center gap-1">
              <span className="text-[var(--warning)]">{"\u25CF"}</span>
              Credit terms avg: {summary.avgCreditTerms} days
            </p>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white overflow-hidden">
        {/* Filter Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--muted)] flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                type="date"
                value={dateFrom}
                onChange={handleDateFromChange}
                className="w-36 text-[13px]"
              />
            </div>
            <span className="text-[var(--muted-foreground)] text-xs">\u2014</span>
            <Input
              type="date"
              value={dateTo}
              onChange={handleDateToChange}
              className="w-36 text-[13px]"
            />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer..."
              className="pl-8 w-52 text-[13px]"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handleStatusFilterChange(f.value)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  statusFilter === f.value
                    ? "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--info-light)] font-semibold"
                    : "bg-transparent text-[var(--muted-foreground)] border border-transparent hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-6">
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="Failed to load data"
              description="An error occurred while fetching accounts receivable. Please try again."
            />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="No receivables found"
              description="No customer aging data matches your current filters."
            />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={customers}
              keyField="id"
              getRowId={(row) => row.id}
              expandedRow={renderExpandedRow}
              expandedRowIds={expandedRowIds}
              onToggleExpand={handleToggleExpand}
              footer={tableFooter}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-[var(--muted)]">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Recording Modal */}
      <Modal
        open={paymentModalOpen}
        onClose={closePaymentModal}
        title="Record Payment"
        size="md"
        actions={
          <>
            <Button variant="secondary" onClick={closePaymentModal}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPaymentMutation.isPending || !paymentAmount}
            >
              {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </>
        }
      >
        {paymentInvoice && (
          <div className="space-y-5">
            {/* Invoice Summary */}
            <div className="bg-[var(--muted)] rounded-[10px] p-4 border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider">
                    Invoice
                  </p>
                  <p className="font-bold text-[var(--foreground)] font-mono">
                    {paymentInvoice.invoiceNo}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider">
                    Outstanding
                  </p>
                  <p className="font-bold text-[var(--destructive)] tabular-nums">
                    ฿{formatCurrency(paymentInvoice.remaining)}
                  </p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                {paymentCustomerName}
                {paymentInvoice.overdueDays > 0 && (
                  <> &mdash; Overdue {paymentInvoice.overdueDays} days</>
                )}
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
                Payment Amount <span className="text-[var(--destructive)]">*</span>
              </label>
              <CurrencyInput
                value={paymentAmount}
                onChange={setPaymentAmount}
              />
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                Full amount pre-filled. Adjust for partial payment.
              </p>
            </div>

            {/* Date + Method */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
                  Payment Date <span className="text-[var(--destructive)]">*</span>
                </label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div>
                <Select
                  label="Payment Method"
                  options={PAYMENT_METHOD_OPTIONS}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                />
              </div>
            </div>

            {/* Reference No */}
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
                Reference No.
              </label>
              <Input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transfer ref, cheque number, etc."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
                Notes
              </label>
              <Input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Optional payment notes"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
