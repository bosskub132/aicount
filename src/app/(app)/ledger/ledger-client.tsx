"use client";

import {
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Download,
  FileText,
  BookOpen,
  Pencil,
  ExternalLink,
  Search,
  Check,
} from "lucide-react";

import { Tabs } from "@/components/tabs";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AccountSelect } from "@/components/account-select";
import {
  JournalLineEditor,
  type JournalLine,
} from "@/components/journal-line-editor";
import { Tooltip } from "@/components/tooltip";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import {
  useJournalEntries,
  useJournalEntry,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  usePostJournalEntry,
} from "@/lib/hooks/use-journal-entries";
import { useAccountLedger } from "@/lib/hooks/use-account-ledger";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useToast } from "@/lib/stores/ui-store";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { exportToCsv } from "@/lib/utils/csv-export";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JournalEntryRow = Record<string, unknown>;

interface AccountLedgerTx {
  date: string;
  jvNo: string;
  entryId: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface AccountLedgerData {
  openingBalance: number;
  openingBalanceDate: string;
  closingBalance: number;
  periodDebits: number;
  periodCredits: number;
  netMovement: number;
  transactions: AccountLedgerTx[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAB_ITEMS = [
  { label: "Journal Entries", value: "journal" },
  { label: "Account Ledger", value: "account" },
];

const TYPE_OPTIONS = [
  { label: "All Types", value: "" },
  { label: "Purchase Voucher (PurV)", value: "PurV" },
  { label: "Receipt Voucher (RV)", value: "RV" },
  { label: "Sales Voucher (SV)", value: "SV" },
  { label: "Journal Voucher (JV)", value: "JV" },
  { label: "Manual", value: "Manual" },
];

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Posted", value: "posted" },
  { label: "Reversed", value: "reversed" },
];

const TYPE_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  PurV: {
    bg: "var(--badge-purv-bg)",
    text: "var(--badge-purv-text)",
  },
  RV: {
    bg: "var(--badge-rv-bg)",
    text: "var(--badge-rv-text)",
  },
  SV: {
    bg: "var(--badge-sv-bg)",
    text: "var(--badge-sv-text)",
  },
  JV: {
    bg: "var(--badge-jv-bg)",
    text: "var(--badge-jv-text)",
  },
  Manual: {
    bg: "var(--badge-manual-bg)",
    text: "var(--badge-manual-text)",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const style = TYPE_BADGE_STYLES[type];
  if (!style) return <Badge>{type}</Badge>;
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-button)] px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {type}
    </span>
  );
}

function StatusBadgeJE({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  if (s === "posted") return <Badge variant="approved">Posted</Badge>;
  if (s === "reversed") return <Badge variant="void">Reversed</Badge>;
  return <Badge variant="draft">Draft</Badge>;
}

function generateLineId(): string {
  return `jl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyLine(): JournalLine {
  return {
    id: generateLineId(),
    accountCode: "",
    deptCode: "",
    debit: undefined,
    credit: undefined,
    description: "",
  };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ---------------------------------------------------------------------------
// Main page export (Suspense wrapper for useSearchParams)
// ---------------------------------------------------------------------------

export default function LedgerClient() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton variant="rect" className="h-96 w-full" />
        </div>
      }
    >
      <LedgerPageContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

function LedgerPageContent() {
  const searchParams = useSearchParams();
  const mounted = useMounted();
  const toast = useToast();
  const tenantId = getWorkspaceTenantId();
  const isDefault = !tenantId;

  // Tab
  const initialTab = searchParams.get("tab") || "journal";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Journal Entries filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Expanded rows
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // JV modal
  const [jvModalOpen, setJvModalOpen] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [jvDate, setJvDate] = useState(todayISO());
  const [jvDescription, setJvDescription] = useState("");
  const [jvLines, setJvLines] = useState<JournalLine[]>([
    emptyLine(),
    emptyLine(),
  ]);

  // Account Ledger
  const [accountCode, setAccountCode] = useState<string | undefined>(
    undefined,
  );
  const [alDateFrom, setAlDateFrom] = useState(firstOfMonthISO());
  const [alDateTo, setAlDateTo] = useState(todayISO());

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Queries
  const journalEntries = useJournalEntries(tenantId, {
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });

  const editEntry = useJournalEntry(tenantId, editEntryId);
  const createMutation = useCreateJournalEntry(tenantId);
  const updateMutation = useUpdateJournalEntry(tenantId);
  const postMutation = usePostJournalEntry(tenantId);
  const accountLedger = useAccountLedger(
    tenantId,
    accountCode ?? null,
    alDateFrom || undefined,
    alDateTo || undefined,
  );

  // Derived data
  const rows: JournalEntryRow[] = useMemo(
    () => (journalEntries.data?.data ?? []) as JournalEntryRow[],
    [journalEntries.data],
  );
  const meta = journalEntries.data?.meta ?? {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  // Stats (from API response or computed from rows)
  const stats = useMemo(() => {
    const summary = journalEntries.data?.summary;
    if (summary) {
      return {
        entriesThisMonth: Number(summary.entriesThisMonth ?? 0),
        draftsPending: Number(summary.draftsPending ?? 0),
        totalDebits: Number(summary.totalDebits ?? 0),
        totalCredits: Number(summary.totalCredits ?? 0),
      };
    }
    // Fallback: compute from visible rows
    let totalDebits = 0;
    let totalCredits = 0;
    let drafts = 0;
    for (const r of (Array.isArray(rows) ? rows : [])) {
      totalDebits += Number(r.totalDebit ?? 0);
      totalCredits += Number(r.totalCredit ?? 0);
      if (String(r.status).toLowerCase() === "draft") drafts++;
    }
    return {
      entriesThisMonth: meta.total,
      draftsPending: drafts,
      totalDebits,
      totalCredits,
    };
  }, [journalEntries.data, rows, meta.total]);

  const isBalanced = Math.abs(stats.totalDebits - stats.totalCredits) < 0.01;

  const [accounts, setAccounts] = useState<
    Array<{ accountCode: string; accountName: string; category: string }>
  >([]);

  useEffect(() => {
    const tid = getWorkspaceTenantId();
    if (!tid) return;
    fetch(`/api/tenants/${tid}/coa?limit=500`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setAccounts(
            json.data
              .filter((a: any) => a.isActive !== false)
              .map((a: any) => ({
                accountCode: a.accountCode,
                accountName: a.accountName,
                category: a.category,
              }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Populate edit modal when entry data loads
  useEffect(() => {
    if (editEntry.data && editEntryId) {
      const entry = editEntry.data;
      startTransition(() => {
        setJvDate(
          entry.date
            ? new Date(entry.date as string).toISOString().slice(0, 10)
            : todayISO(),
        );
        setJvDescription(String(entry.description ?? ""));
        const entryLines = (entry.lines as Array<Record<string, unknown>>) ?? [];
        if (entryLines.length > 0) {
          setJvLines(
            entryLines.map((l) => ({
              id: generateLineId(),
              accountCode: String(l.accountCode ?? ""),
              deptCode: String(l.deptCode ?? ""),
              debit: l.debit ? Number(l.debit) : undefined,
              credit: l.credit ? Number(l.credit) : undefined,
              description: String(l.description ?? ""),
            })),
          );
        }
      });
    }
  }, [editEntry.data, editEntryId]);

  // Row click toggles expand
  const handleRowClick = useCallback(
    (row: JournalEntryRow) => {
      const id = String(row.id);
      setExpandedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  // Open create modal
  const openCreateModal = useCallback(() => {
    setEditEntryId(null);
    setJvDate(todayISO());
    setJvDescription("");
    setJvLines([emptyLine(), emptyLine()]);
    setJvModalOpen(true);
  }, []);

  // Open edit modal
  const openEditModal = useCallback((entryId: string) => {
    setEditEntryId(entryId);
    setJvModalOpen(true);
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setJvModalOpen(false);
    setEditEntryId(null);
    setJvDate(todayISO());
    setJvDescription("");
    setJvLines([emptyLine(), emptyLine()]);
  }, []);

  // Compute balance for JV lines
  const jvTotalDebit = useMemo(
    () => jvLines.reduce((s, l) => s + (l.debit ?? 0), 0),
    [jvLines],
  );
  const jvTotalCredit = useMemo(
    () => jvLines.reduce((s, l) => s + (l.credit ?? 0), 0),
    [jvLines],
  );
  const jvIsBalanced =
    Math.abs(Math.round((jvTotalDebit - jvTotalCredit) * 100) / 100) === 0;

  // Save as Draft
  const handleSaveDraft = useCallback(async () => {
    const payload = {
      date: jvDate,
      description: jvDescription,
      lines: jvLines
        .filter((l) => l.accountCode)
        .map((l) => ({
          accountCode: l.accountCode,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        })),
    };

    if (editEntryId) {
      await updateMutation.mutateAsync({ entryId: editEntryId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    closeModal();
  }, [
    jvDate,
    jvDescription,
    jvLines,
    editEntryId,
    updateMutation,
    createMutation,
    closeModal,
  ]);

  // Post entry
  const handlePost = useCallback(async () => {
    try {
      if (editEntryId) {
        // Update first, then post
        const payload = {
          date: jvDate,
          description: jvDescription,
          lines: jvLines
            .filter((l) => l.accountCode)
            .map((l) => ({
              accountCode: l.accountCode,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
        };
        await updateMutation.mutateAsync({
          entryId: editEntryId,
          ...payload,
        });
        await postMutation.mutateAsync(editEntryId);
      } else {
        const result = await createMutation.mutateAsync({
          date: jvDate,
          description: jvDescription,
          lines: jvLines
            .filter((l) => l.accountCode)
            .map((l) => ({
              accountCode: l.accountCode,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
        });
        if (result?.id) {
          await postMutation.mutateAsync(result.id);
        }
      }
      closeModal();
    } catch {
      // Errors handled by mutation hooks
    }
  }, [
    jvDate,
    jvDescription,
    jvLines,
    editEntryId,
    updateMutation,
    createMutation,
    postMutation,
    closeModal,
  ]);

  // Export
  const handleExport = useCallback(() => {
    const csvCols = [
      "Date",
      "JV No",
      "Type",
      "Description",
      "Debit",
      "Credit",
      "Status",
    ];
    const csvRows = rows.map((r) => [
      String(r.date ?? ""),
      String(r.jvNo ?? r.entryNumber ?? ""),
      String(r.type ?? ""),
      String(r.description ?? ""),
      String(r.totalDebit ?? "0"),
      String(r.totalCredit ?? "0"),
      String(r.status ?? ""),
    ]);
    exportToCsv(csvCols, csvRows, `journal-entries-${todayISO()}`);
    toast.success("Exported to CSV");
  }, [rows, toast]);

  // Filter rows by type (client-side since API may not support type filter)
  const filteredRows = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter(
      (r) =>
        String(r.type ?? "").toLowerCase() === typeFilter.toLowerCase(),
    );
  }, [rows, typeFilter]);

  // Columns
  const columns: Column<JournalEntryRow>[] = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        width: "100px",
        render: (row) => (
          <span className="text-sm">
            {row.date ? formatDate(row.date as string) : "\u2014"}
          </span>
        ),
      },
      {
        key: "jvNo",
        header: "JV No",
        width: "110px",
        render: (row) => (
          <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
            {String(row.jvNo ?? row.entryNumber ?? "\u2014")}
          </span>
        ),
      },
      {
        key: "type",
        header: "Type",
        width: "90px",
        render: (row) => <TypeBadge type={String(row.type ?? "JV")} />,
      },
      {
        key: "description",
        header: "Description",
        render: (row) => {
          const isReversed =
            String(row.status ?? "").toLowerCase() === "reversed";
          return (
            <span
              className={
                isReversed
                  ? "line-through opacity-55"
                  : "text-[var(--foreground)]"
              }
            >
              {String(row.description ?? "\u2014")}
            </span>
          );
        },
      },
      {
        key: "totalDebit",
        header: "Debit",
        align: "right",
        width: "120px",
        render: (row) => (
          <span className="tabular-nums">
            {formatCurrency(Number(row.totalDebit ?? 0))}
          </span>
        ),
      },
      {
        key: "totalCredit",
        header: "Credit",
        align: "right",
        width: "120px",
        render: (row) => (
          <span className="tabular-nums">
            {formatCurrency(Number(row.totalCredit ?? 0))}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "90px",
        render: (row) => (
          <StatusBadgeJE status={String(row.status ?? "draft")} />
        ),
      },
      {
        key: "documentId",
        header: "Source",
        width: "60px",
        render: (row) =>
          row.documentId ? (
            <a
              href={`/documents/${row.documentId}`}
              className="text-[var(--primary)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <span className="text-[var(--muted-foreground)]">\u2014</span>
          ),
      },
      {
        key: "edit",
        header: "",
        width: "50px",
        sortable: false,
        render: (row) => {
          const isReversed =
            String(row.status ?? "").toLowerCase() === "reversed";
          const isLocked = Boolean(row.periodLocked);
          const disabled = isReversed || isLocked;
          return disabled ? (
            <Tooltip content={isLocked ? "Period locked" : "Entry reversed"}>
              <span className="inline-flex items-center justify-center p-1.5 text-[var(--muted-foreground)] opacity-40">
                <Pencil className="h-4 w-4" />
              </span>
            </Tooltip>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(String(row.id));
              }}
              className="inline-flex items-center justify-center rounded-[var(--radius-button)] p-1.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors cursor-pointer"
              aria-label="Edit entry"
            >
              <Pencil className="h-4 w-4" />
            </button>
          );
        },
      },
    ],
    [openEditModal],
  );

  // Expanded row renderer
  const renderExpandedRow = useCallback(
    (row: JournalEntryRow) => {
      const lines = (row.lines as Array<Record<string, unknown>>) ?? [];
      if (lines.length === 0) {
        return (
          <p className="text-sm text-[var(--muted-foreground)] py-2">
            No line details available
          </p>
        );
      }

      const totalDebit = lines.reduce(
        (s, l) => s + Number(l.debit ?? 0),
        0,
      );
      const totalCredit = lines.reduce(
        (s, l) => s + Number(l.credit ?? 0),
        0,
      );
      const diff = Math.abs(
        Math.round((totalDebit - totalCredit) * 100) / 100,
      );

      return (
        <div className="py-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
                <th className="text-left px-3 py-1.5 font-semibold">
                  Account Code
                </th>
                <th className="text-left px-3 py-1.5 font-semibold">
                  Account Name
                </th>
                <th className="text-left px-3 py-1.5 font-semibold">
                  Dept
                </th>
                <th className="text-left px-3 py-1.5 font-semibold">
                  Description
                </th>
                <th className="text-right px-3 py-1.5 font-semibold">
                  Debit
                </th>
                <th className="text-right px-3 py-1.5 font-semibold">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr
                  key={i}
                  className="border-t border-[var(--border)]/50"
                >
                  <td className="px-3 py-1.5">
                    <span className="font-mono text-xs font-bold text-[var(--primary)]">
                      {String(l.accountCode ?? "")}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    {String(l.accountName ?? "")}
                  </td>
                  <td className="px-3 py-1.5">
                    {l.deptCode ? (
                      <Badge>{String(l.deptCode)}</Badge>
                    ) : (
                      "\u2014"
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {String(l.description ?? "")}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {Number(l.debit ?? 0) > 0
                      ? formatCurrency(Number(l.debit))
                      : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {Number(l.credit ?? 0) > 0
                      ? formatCurrency(Number(l.credit))
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border)] font-semibold">
                <td colSpan={4} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(totalDebit)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(totalCredit)}
                </td>
              </tr>
              <tr>
                <td colSpan={6} className="px-3 py-1.5 text-right">
                  {diff === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--success)] font-semibold">
                      <Check className="h-3.5 w-3.5" /> Balanced
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--destructive)] font-semibold tabular-nums">
                      Difference: {formatCurrency(diff)}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      );
    },
    [],
  );

  // Account Ledger data
  const alData = accountLedger.data as AccountLedgerData | undefined;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isDefault) {
    return (
      <section className="space-y-5 p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Select a client from the workspace menu in the header to load ledger
          data.
        </div>
      </section>
    );
  }

  const queryLoading = journalEntries.isLoading;
  const isLoading = !mounted || queryLoading;

  return (
    <section className="space-y-5 p-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            General Ledger
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            สมุดบัญชีแยกประเภท — Journal entries &amp; account transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={openCreateModal}
          >
            New Journal Entry
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="100px" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Entries This Month */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 border-l-4 border-l-[var(--primary)]">
            <p className="text-xs text-[var(--muted-foreground)]">
              Entries This Month
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">
              {stats.entriesThisMonth}
            </p>
          </div>

          {/* Drafts Pending */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 border-l-4 border-l-amber-400">
            <p className="text-xs text-[var(--muted-foreground)]">
              Drafts Pending
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-600 tabular-nums">
              {stats.draftsPending}
            </p>
          </div>

          {/* Total Debits */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 border-l-4 border-l-[var(--success)]">
            <p className="text-xs text-[var(--muted-foreground)]">
              Total Debits
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">
              {formatCurrency(stats.totalDebits)}
            </p>
          </div>

          {/* Total Credits */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
            <p className="text-xs text-[var(--muted-foreground)]">
              Total Credits
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">
              {formatCurrency(stats.totalCredits)}
            </p>
            {isBalanced && (
              <p className="mt-1 flex items-center gap-1 text-xs text-[var(--success)] font-medium">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                Balanced
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={TAB_ITEMS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Journal Entries */}
      {activeTab === "journal" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-36"
                placeholder="From"
              />
              <span className="text-[var(--muted-foreground)]">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-36"
                placeholder="To"
              />
            </div>

            <div className="w-48">
              <Select
                options={TYPE_OPTIONS}
                value={typeFilter}
                onChange={(v) => {
                  setTypeFilter(v);
                  setPage(1);
                }}
                placeholder="All Types"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {STATUS_FILTERS.map((sf) => (
                <button
                  key={sf.value}
                  onClick={() => {
                    setStatusFilter(sf.value);
                    setPage(1);
                  }}
                  className={`rounded-[var(--radius-button)] px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === sf.value
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search entries..."
                className="pl-9 w-56"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rect" width="100%" height="48px" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="No journal entries"
              description="Create your first journal entry to get started."
              action={{
                label: "New Journal Entry",
                onClick: openCreateModal,
              }}
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredRows}
              keyField="id"
              onRowClick={handleRowClick}
              expandedRow={renderExpandedRow}
              expandedRowIds={expandedRowIds}
              onToggleExpand={(id) => {
                setExpandedRowIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              sortable
              emptyMessage="No journal entries found"
            />
          )}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Tab 2: Account Ledger */}
      {activeTab === "account" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-72">
              <AccountSelect
                value={accountCode}
                onChange={setAccountCode}
                accounts={accounts}
                placeholder="Select account..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={alDateFrom}
                onChange={(e) => setAlDateFrom(e.target.value)}
                className="w-36"
              />
              <span className="text-[var(--muted-foreground)]">to</span>
              <Input
                type="date"
                value={alDateTo}
                onChange={(e) => setAlDateTo(e.target.value)}
                className="w-36"
              />
            </div>
          </div>

          {!accountCode ? (
            <EmptyState
              icon={<BookOpen className="h-10 w-10" />}
              title="Select an account"
              description="Choose an account from the dropdown to view its ledger."
            />
          ) : accountLedger.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rect" width="100%" height="48px" />
              ))}
            </div>
          ) : !alData ? (
            <EmptyState
              icon={<BookOpen className="h-10 w-10" />}
              title="No ledger data"
              description="No transactions found for this account and date range."
            />
          ) : (
            <>
              {/* Opening Balance Banner */}
              <div className="flex items-center justify-between rounded-[var(--radius-card)] bg-blue-50 border border-blue-200 px-5 py-3">
                <span className="text-sm font-medium text-blue-900">
                  Opening Balance —{" "}
                  {alData.openingBalanceDate
                    ? formatDate(alData.openingBalanceDate)
                    : alDateFrom}
                </span>
                <span className="text-sm font-bold text-blue-900 tabular-nums">
                  {formatCurrency(Math.abs(alData.openingBalance))}{" "}
                  {alData.openingBalance >= 0 ? "Dr" : "Cr"}
                </span>
              </div>

              {/* Transactions Table */}
              {(alData.transactions ?? []).length > 0 ? (
                <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          Date
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          JV No
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          Description
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          Debit
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          Credit
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {alData.transactions.map((tx, i) => (
                        <tr
                          key={i}
                          className="border-b border-[var(--muted)] last:border-0 hover:bg-[var(--primary-light)] transition-colors"
                        >
                          <td className="px-4 py-3 text-sm">
                            {formatDate(tx.date)}
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={`/ledger?tab=journal&search=${encodeURIComponent(tx.jvNo)}`}
                              className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline"
                            >
                              {tx.jvNo}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {tx.description}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {tx.debit > 0 ? formatCurrency(tx.debit) : ""}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {tx.credit > 0 ? formatCurrency(tx.credit) : ""}
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums">
                            {formatCurrency(Math.abs(tx.runningBalance))}{" "}
                            <span className="text-xs font-normal text-[var(--muted-foreground)]">
                              {tx.runningBalance >= 0 ? "Dr" : "Cr"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<BookOpen className="h-10 w-10" />}
                  title="No transactions"
                  description="No transactions found for this period."
                />
              )}

              {/* Summary Footer */}
              <div className="flex flex-wrap items-center gap-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3 text-sm">
                <div>
                  <span className="text-[var(--muted-foreground)]">
                    Period Debits:{" "}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(alData.periodDebits)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)]">
                    Period Credits:{" "}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(alData.periodCredits)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)]">
                    Net Movement:{" "}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(Math.abs(alData.netMovement))}{" "}
                    {alData.netMovement >= 0 ? "Dr" : "Cr"}
                  </span>
                </div>
              </div>

              {/* Closing Balance Banner */}
              <div className="flex items-center justify-between rounded-[var(--radius-card)] bg-green-50 border border-green-200 px-5 py-3">
                <span className="text-sm font-medium text-green-900">
                  Closing Balance
                </span>
                <span className="text-sm font-bold text-green-900 tabular-nums">
                  {formatCurrency(Math.abs(alData.closingBalance))}{" "}
                  {alData.closingBalance >= 0 ? "Dr" : "Cr"}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* JV Creation / Edit Modal */}
      <Modal
        open={jvModalOpen}
        onClose={closeModal}
        title={editEntryId ? "Edit Journal Entry" : "New Journal Entry"}
        size="lg"
        actions={
          <>
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              onClick={handlePost}
              disabled={!jvIsBalanced}
              loading={postMutation.isPending}
            >
              {editEntryId ? "Save Changes" : "Post"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={jvDate}
              onChange={(e) => setJvDate(e.target.value)}
              required
            />
            <Input
              label="Description"
              value={jvDescription}
              onChange={(e) => setJvDescription(e.target.value)}
              placeholder="Entry description..."
              required
            />
          </div>

          <JournalLineEditor
            lines={jvLines}
            onChange={setJvLines}
            accounts={accounts}
          />
        </div>
      </Modal>
    </section>
  );
}
