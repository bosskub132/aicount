"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Users,
  CalendarClock,
  CheckCircle2,
  Building2,
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
import { StatCard } from "@/components/stat-card";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { usePayables } from "@/lib/hooks/use-payables";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useRecordPayment } from "@/lib/hooks/use-payments";
import { useToast } from "@/lib/stores/ui-store";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { exportToCsv } from "@/lib/utils/csv-export";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VendorInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  dueDate: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  whtRate?: number;
}

interface VendorRow {
  id: string;
  name: string;
  taxId?: string;
  defaultWhtRate?: number;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  overdue: number;
  total: number;
  invoices?: VendorInvoice[];
}

interface PayablesSummary {
  totalPayables: number;
  dueThisWeek: number;
  paidThisMonth: number;
  topVendor: string;
  topVendorAmount: number;
}

interface PayablesResponse {
  success: boolean;
  data: {
    vendors: VendorRow[];
    summary: PayablesSummary;
    total: number;
    page: number;
    limit: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Outstanding", value: "outstanding" },
  { label: "Overdue", value: "overdue" },
  { label: "Paid", value: "paid" },
];

const PAYMENT_METHODS = [
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Cash", value: "cash" },
  { label: "Cheque", value: "cheque" },
  { label: "PromptPay", value: "promptpay" },
];

// ---------------------------------------------------------------------------
// Main page export (Suspense wrapper for useSearchParams)
// ---------------------------------------------------------------------------

export default function PayablesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton variant="rect" className="h-96 w-full" />
        </div>
      }
    >
      <PayablesPageContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

function PayablesPageContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const mounted = useMounted();
  const tenantId = getWorkspaceTenantId();
  const isDefault = !tenantId;

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "");

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

  // Reset page on status filter change
  const handleStatusChange = useCallback((val: string) => {
    setStatus(val);
    setPage(1);
  }, []);

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    invoice?: VendorInvoice;
    vendor?: VendorRow;
  }>({ open: false });
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    whtAmount: 0,
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "bank_transfer",
    reference: "",
    notes: "",
  });

  // Data
  const { data: rawData, isLoading: queryLoading, error } = usePayables(tenantId, {
    status,
    search: debouncedSearch,
    page,
    limit: 20,
  });
  const isLoading = !mounted || queryLoading;

  const payablesData = rawData as PayablesResponse | undefined;
  const vendors = useMemo(() => payablesData?.data?.vendors ?? [], [payablesData?.data?.vendors]);
  const summary = payablesData?.data?.summary;
  const totalItems = payablesData?.data?.total ?? 0;
  const pageSize = payablesData?.data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Payment mutation
  const recordPayment = useRecordPayment(tenantId);

  // Toggle row expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Open payment modal
  const openPaymentModal = useCallback(
    (invoice: VendorInvoice, vendor: VendorRow) => {
      const whtRate = invoice.whtRate ?? vendor.defaultWhtRate ?? 0;
      const grossAmount = invoice.balance;
      const whtAmount = grossAmount * (whtRate / 100);

      setPaymentForm({
        amount: grossAmount,
        whtAmount,
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "bank_transfer",
        reference: "",
        notes: "",
      });
      setPaymentModal({ open: true, invoice, vendor });
    },
    [],
  );

  const closePaymentModal = useCallback(() => {
    setPaymentModal({ open: false });
  }, []);

  // Compute net payment
  const netPayment = paymentForm.amount - paymentForm.whtAmount;

  // Handle payment submit
  const handleRecordPayment = useCallback(async () => {
    if (!paymentModal.invoice) return;
    if (netPayment <= 0) {
      toast.error("Net payment must be greater than zero");
      return;
    }

    await recordPayment.mutateAsync({
      type: "payable",
      invoiceId: paymentModal.invoice.id,
      amount: netPayment,
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      reference: paymentForm.reference || undefined,
      notes: paymentForm.notes || undefined,
      whtAmount: paymentForm.whtAmount > 0 ? paymentForm.whtAmount : undefined,
    });

    closePaymentModal();
  }, [
    paymentModal.invoice,
    netPayment,
    paymentForm,
    recordPayment,
    closePaymentModal,
    toast,
  ]);

  // Export CSV
  const handleExport = useCallback(() => {
    if (vendors.length === 0) {
      toast.error("No data to export");
      return;
    }

    const columns = [
      "Vendor",
      "Tax ID",
      "WHT Rate",
      "Current",
      "1-30 Days",
      "31-60 Days",
      "61-90 Days",
      "90+ Days",
      "Total",
    ];

    const rows = vendors.map((v) => [
      v.name,
      v.taxId || "",
      v.defaultWhtRate ? `${v.defaultWhtRate}%` : "",
      formatCurrency(v.current),
      formatCurrency(v.d30),
      formatCurrency(v.d60),
      formatCurrency(v.d90),
      formatCurrency(v.overdue),
      formatCurrency(v.total),
    ]);

    exportToCsv(columns, rows, `payables-aging-${new Date().toISOString().split("T")[0]}.csv`);
    toast.success("Exported payables aging report");
  }, [vendors, toast]);

  // Aging columns
  const columns: Column<VendorRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Vendor",
        render: (row) => (
          <div className="flex items-center gap-2">
            <div>
              <p className="font-medium text-[var(--foreground)]">{row.name}</p>
              {row.taxId && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {row.taxId}
                </p>
              )}
            </div>
            {row.defaultWhtRate != null && row.defaultWhtRate > 0 && (
              <span className="inline-flex items-center rounded-[var(--radius-button)] bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                WHT {row.defaultWhtRate}%
              </span>
            )}
          </div>
        ),
      },
      {
        key: "current",
        header: "Current",
        align: "right" as const,
        render: (row) => (
          <span className="tabular-nums text-[var(--aging-current)]">
            {formatCurrency(row.current)}
          </span>
        ),
      },
      {
        key: "d30",
        header: "1-30d",
        align: "right" as const,
        render: (row) => (
          <span className="tabular-nums text-[var(--aging-30)]">
            {formatCurrency(row.d30)}
          </span>
        ),
      },
      {
        key: "d60",
        header: "31-60d",
        align: "right" as const,
        render: (row) => (
          <span className="tabular-nums text-[var(--aging-60)]">
            {formatCurrency(row.d60)}
          </span>
        ),
      },
      {
        key: "d90",
        header: "61-90d",
        align: "right" as const,
        render: (row) => (
          <span className="tabular-nums text-[var(--aging-90)]">
            {formatCurrency(row.d90)}
          </span>
        ),
      },
      {
        key: "overdue",
        header: "90+d",
        align: "right" as const,
        render: (row) => (
          <span className="tabular-nums text-[var(--aging-overdue)]">
            {formatCurrency(row.overdue)}
          </span>
        ),
      },
      {
        key: "total",
        header: "Total",
        align: "right" as const,
        render: (row) => (
          <span className="tabular-nums font-semibold text-[var(--foreground)]">
            {formatCurrency(row.total)}
          </span>
        ),
      },
      {
        key: "expand",
        header: "",
        width: "40px",
        render: (row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(row.id);
            }}
            className="p-1 rounded-[var(--radius-button)] hover:bg-[var(--muted)] cursor-pointer"
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
    ],
    [expandedIds, toggleExpand],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isDefault) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="Select a workspace"
          description="Choose a workspace from the sidebar to view accounts payable."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Accounts Payable
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            เจ้าหนี้การค้า — Vendor invoices &amp; aging analysis
          </p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Payables"
            value={`฿${formatCurrency(summary?.totalPayables ?? 0)}`}
          />
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] border-l-4 border-l-amber-500 bg-white p-5">
            <p className="text-xs text-[var(--muted-foreground)]">Due This Week</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">
              ฿{formatCurrency(summary?.dueThisWeek ?? 0)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
              <CalendarClock className="h-3.5 w-3.5" />
              Upcoming payments
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] border-l-4 border-l-[var(--success)] bg-white p-5">
            <p className="text-xs text-[var(--muted-foreground)]">Paid This Month</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">
              ฿{formatCurrency(summary?.paidThisMonth ?? 0)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--success)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Settled
            </p>
          </div>
          <StatCard
            title="Top Vendor"
            value={summary?.topVendor || "—"}
            trendValue={
              summary?.topVendorAmount
                ? `฿${formatCurrency(summary.topVendorAmount)} outstanding`
                : undefined
            }
          />
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-2 focus:outline-[var(--ring)] focus:outline-offset-0"
          />
        </div>
        <div className="w-40">
          <Select
            options={STATUS_FILTERS}
            value={status}
            onChange={handleStatusChange}
            placeholder="Status"
          />
        </div>
      </div>

      {/* Aging Table */}
      {isLoading ? (
        <Skeleton variant="rect" className="h-80 w-full" />
      ) : error ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="Error loading payables"
          description="An error occurred while loading accounts payable data. Please try again."
        />
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No payables found"
          description={
            debouncedSearch || status
              ? "Try adjusting your search or filters."
              : "Vendor invoices will appear here once documents are processed."
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={vendors as (VendorRow & Record<string, unknown>)[]}
            keyField="id"
            expandedRowIds={expandedIds}
            onToggleExpand={toggleExpand}
            getRowId={(row) => row.id as string}
            expandedRow={(row) => (
              <VendorInvoicesSubTable
                vendor={row as unknown as VendorRow}
                onRecordPayment={openPaymentModal}
              />
            )}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* Payment Recording Modal (with WHT) */}
      <Modal
        open={paymentModal.open}
        onClose={closePaymentModal}
        title="Record Payment"
        size="lg"
        actions={
          <>
            <Button variant="secondary" onClick={closePaymentModal}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPayment.isPending || netPayment <= 0}
            >
              {recordPayment.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </>
        }
      >
        {paymentModal.invoice && paymentModal.vendor && (
          <div className="flex flex-col gap-4">
            {/* Invoice info */}
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--muted)] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {paymentModal.vendor.name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Invoice: {paymentModal.invoice.invoiceNo}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Outstanding Balance
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    ฿{formatCurrency(paymentModal.invoice.balance)}
                  </p>
                </div>
              </div>
            </div>

            {/* WHT Deduction Section */}
            <div className="rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2">
                WHT Deduction (หัก ณ ที่จ่าย)
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">
                    Gross Amount
                  </span>
                  <span className="tabular-nums font-medium text-[var(--foreground)]">
                    ฿{formatCurrency(paymentForm.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">
                    WHT Amount
                    {paymentModal.vendor.defaultWhtRate != null &&
                      paymentModal.vendor.defaultWhtRate > 0 && (
                        <span className="ml-1 text-[10px] text-amber-700">
                          (default {paymentModal.vendor.defaultWhtRate}%)
                        </span>
                      )}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={paymentForm.amount}
                    value={paymentForm.whtAmount}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        whtAmount: Math.max(
                          0,
                          Math.min(
                            prev.amount,
                            parseFloat(e.target.value) || 0,
                          ),
                        ),
                      }))
                    }
                    className="w-28 rounded-[var(--radius-input)] border border-amber-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-[var(--foreground)] focus:outline-2 focus:outline-amber-400 focus:outline-offset-0"
                  />
                </div>
                <div className="border-t border-amber-200 pt-2 flex items-center justify-between text-sm font-semibold">
                  <span className="text-[var(--foreground)]">Net Payment</span>
                  <span className="tabular-nums text-[var(--foreground)]">
                    ฿{formatCurrency(netPayment)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Payment Date"
                type="date"
                required
                value={paymentForm.paymentDate}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentDate: e.target.value,
                  }))
                }
              />
              <Select
                label="Payment Method"
                options={PAYMENT_METHODS}
                value={paymentForm.paymentMethod}
                onChange={(val) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentMethod: val,
                  }))
                }
              />
            </div>
            <Input
              label="Reference / Cheque No."
              placeholder="e.g. TRF-2026-001"
              value={paymentForm.reference}
              onChange={(e) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  reference: e.target.value,
                }))
              }
            />
            <Input
              label="Notes"
              placeholder="Optional notes"
              value={paymentForm.notes}
              onChange={(e) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor Invoices Sub-Table (expanded row)
// ---------------------------------------------------------------------------

function VendorInvoicesSubTable({
  vendor,
  onRecordPayment,
}: {
  vendor: VendorRow;
  onRecordPayment: (invoice: VendorInvoice, vendor: VendorRow) => void;
}) {
  const invoices = vendor.invoices ?? [];

  if (invoices.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
        No invoices found for this vendor.
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
            <th className="pb-2 text-left font-medium">Invoice</th>
            <th className="pb-2 text-left font-medium">Date</th>
            <th className="pb-2 text-left font-medium">Due Date</th>
            <th className="pb-2 text-right font-medium">Amount</th>
            <th className="pb-2 text-right font-medium">Paid</th>
            <th className="pb-2 text-right font-medium">Balance</th>
            <th className="pb-2 text-center font-medium">Status</th>
            <th className="pb-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="py-2 text-[var(--foreground)]">
                <div className="flex items-center gap-1.5">
                  {inv.invoiceNo}
                  {(inv.whtRate ?? vendor.defaultWhtRate ?? 0) > 0 && (
                    <span className="inline-flex items-center rounded-sm bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800">
                      WHT
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2 text-[var(--muted-foreground)]">
                {formatDate(inv.date)}
              </td>
              <td className="py-2 text-[var(--muted-foreground)]">
                {formatDate(inv.dueDate)}
              </td>
              <td className="py-2 text-right tabular-nums text-[var(--foreground)]">
                {formatCurrency(inv.amount)}
              </td>
              <td className="py-2 text-right tabular-nums text-[var(--success)]">
                {formatCurrency(inv.paid)}
              </td>
              <td className="py-2 text-right tabular-nums font-medium text-[var(--foreground)]">
                {formatCurrency(inv.balance)}
              </td>
              <td className="py-2 text-center">
                <InvoiceStatusBadge status={inv.status} />
              </td>
              <td className="py-2 text-right">
                {inv.balance > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRecordPayment(inv, vendor)}
                  >
                    <CreditCard className="mr-1 h-3 w-3" />
                    Pay
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice Status Badge
// ---------------------------------------------------------------------------

function InvoiceStatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();

  if (lower === "paid") {
    return (
      <Badge variant="approved">
        Paid
      </Badge>
    );
  }
  if (lower === "overdue") {
    return (
      <Badge variant="rejected">
        Overdue
      </Badge>
    );
  }
  if (lower === "partial") {
    return (
      <Badge variant="processing">
        Partial
      </Badge>
    );
  }
  return (
    <Badge variant="pending">
      {status}
    </Badge>
  );
}
