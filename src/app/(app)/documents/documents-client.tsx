"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDocuments, useDocumentMutations } from "@/lib/hooks/use-documents";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { Tabs } from "@/components/tabs";
import { DataTable, type Column } from "@/components/data-table";
import { DocumentSidePanel } from "@/components/document-side-panel";
import { Pagination } from "@/components/pagination";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import { StatusBadge, Badge } from "@/components/badge";
import { Modal } from "@/components/modal";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { FileText, Search, Upload, CheckCircle, ExternalLink } from "lucide-react";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "action", label: "Action Required", filterStatuses: ["DRAFT", "OCR_PROCESSING", "ACTION_REQUIRED"] },
  { id: "query", label: "Query", filterStatuses: ["QUERY"] },
  { id: "pending", label: "Pending", filterStatuses: ["PENDING_APPROVAL"] },
  { id: "approved", label: "Approved", filterStatuses: ["APPROVED", "EXPORTED"] },
  { id: "rejected", label: "Rejected", filterStatuses: ["REJECTED"] },
  { id: "void", label: "Void", filterStatuses: ["VOID"] },
] as const;

export default function DocumentsClient() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton variant="rect" className="h-96 w-full" /></div>}>
      <DocumentsPageContent />
    </Suspense>
  );
}

function DocumentsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const tenantId = getWorkspaceTenantId();

  const mounted = useMounted();

  // Tab from URL - sync with searchParams
  const urlTab = searchParams.get("tab") || "all";
  const [activeTab, setActiveTab] = useState(urlTab);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  // Pagination + search
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Side panel
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ docId: string } | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  // Role-based permissions
  const [permissions, setPermissions] = useState({ canSubmit: false, canApprove: false });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch workspace role on mount
  useEffect(() => {
    if (!tenantId || tenantId === "00000000-0000-0000-0000-000000000000") return;

    fetch(`/api/auth/workspace-role?tenantId=${tenantId}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.data) {
          setPermissions({
            canSubmit: Boolean(json.data.canSubmitForApproval),
            canApprove: Boolean(json.data.canApproveDocuments),
          });
        }
      })
      .catch(() => {});
  }, [tenantId]);

  // Fetch all documents once — filter by tab client-side
  const { data, isLoading: queryLoading } = useDocuments({
    page,
    limit: 100,
    search: debouncedSearch || undefined,
  });

  // Show loading until mounted (hydration-safe) and query is done
  const isLoading = !mounted || queryLoading;

  const allRows = useMemo(() => (data?.data ?? []) as Record<string, unknown>[], [data]);

  // Client-side tab filtering
  const rows = useMemo(() => {
    const tab = STATUS_TABS.find((t) => t.id === activeTab);
    if (!tab || !("filterStatuses" in tab)) return allRows;
    const allowed = new Set((tab as { filterStatuses: readonly string[] }).filterStatuses);
    return allRows.filter((r) => allowed.has(r.status as string));
  }, [allRows, activeTab]);

  const meta = data?.meta ?? { total: 0, page: 1, limit: 100, totalPages: 1 };

  const { submit, approve, reject, reOcr, deleteDoc } = useDocumentMutations();

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState<{ docId: string } | null>(null);

  // Column definitions
  const columns: Column<Record<string, unknown>>[] = useMemo(
    () => [
      {
        key: "issuerName",
        header: "Issuer",
        render: (row) => (
          <span className="font-medium text-[var(--foreground)]">
            {(row.issuerName as string) || "—"}
          </span>
        ),
      },
      {
        key: "documentNumber",
        header: "Doc No.",
        render: (row) => (row.documentNumber as string) || "—",
      },
      {
        key: "grandTotal",
        header: "Amount",
        align: "right" as const,
        render: (row) =>
          row.grandTotal ? (
            <span className="tabular-nums">
              {"\u0E3F"}
              {Number(row.grandTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </span>
          ) : (
            "—"
          ),
      },
      {
        key: "direction",
        header: "Direction",
        render: (row) =>
          row.direction ? (
            <Badge variant={row.direction === "REVENUE" ? "approved" : "action_required"}>
              {row.direction as string}
            </Badge>
          ) : (
            "—"
          ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status as string} />,
      },
      {
        key: "documentDate",
        header: "Date",
        render: (row) =>
          row.documentDate
            ? new Date(row.documentDate as string).toLocaleDateString("th-TH")
            : "—",
      },
      {
        key: "createdAt",
        header: "Uploaded",
        render: (row) =>
          row.createdAt
            ? new Date(row.createdAt as string).toLocaleString("th-TH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—",
      },
      {
        key: "actions",
        header: "",
        align: "center" as const,
        render: (row) => (
          <button
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/extractions?docId=${row.id as string}`);
            }}
            title="Open extraction details"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Details</span>
          </button>
        ),
      },
    ],
    []
  );

  // Event handlers
  const handleTabChange = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setSelectedDocId(null);
      setSelectedIds([]);
      router.push(`/documents?tab=${tabId}`, { scroll: false });
    },
    [router]
  );

  const handleRowClick = useCallback(
    (row: Record<string, unknown>) => {
      const docId = row.id as string;
      setSelectedDocId(docId === selectedDocId ? null : docId);
    },
    [selectedDocId]
  );

  const handleRowDoubleClick = useCallback(
    (row: Record<string, unknown>) => {
      router.push(`/extractions?docId=${row.id as string}`);
    },
    [router]
  );

  const handleAction = useCallback(
    async (action: string, docId: string) => {
      try {
        if (action === "edit") {
          router.push(`/extractions?docId=${docId}`);
        } else if (action === "submit") {
          await submit.mutateAsync(docId);
          toast.success("Submitted for approval");
        } else if (action === "approve") {
          await approve.mutateAsync(docId);
          toast.success("Document approved");
          setSelectedDocId(null);
        } else if (action === "reject") {
          setRejectModal({ docId });
        } else if (action === "re-ocr") {
          await reOcr.mutateAsync(docId);
          toast.info("Re-processing OCR...");
        } else if (action === "delete") {
          setDeleteModal({ docId });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    },
    [router, submit, approve, reOcr, toast]
  );

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectModal) return;
    try {
      await reject.mutateAsync({
        docId: rejectModal.docId,
        comment: rejectComment || "Rejected",
      });
      toast.success("Document rejected");
      setRejectModal(null);
      setRejectComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    }
  }, [rejectModal, rejectComment, reject, toast]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal) return;
    try {
      await deleteDoc.mutateAsync(deleteModal.docId);
      toast.success("Document deleted");
      setDeleteModal(null);
      setSelectedDocId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }, [deleteModal, deleteDoc, toast]);

  const handleBulkApprove = useCallback(async () => {
    let successCount = 0;
    let failCount = 0;
    for (const docId of selectedIds) {
      try {
        await approve.mutateAsync(docId);
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) toast.success(`${successCount} document(s) approved`);
    if (failCount > 0) toast.error(`${failCount} document(s) failed to approve`);
    setSelectedIds([]);
  }, [selectedIds, approve, toast]);

  const handleSelect = useCallback((selected: Record<string, unknown>[]) => {
    setSelectedIds(selected.map((r) => r.id as string));
  }, []);

  // Tabs config with counts (counts from meta.total for active, not per-tab since server filters)
  const tabItems = useMemo(
    () =>
      STATUS_TABS.map((t) => ({
        label: t.label,
        value: t.id,
      })),
    []
  );

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 p-6 gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isLoading ? (
            <>
              <Skeleton variant="text" width="200px" height="28px" />
              <Skeleton variant="rect" width="200px" height="36px" />
            </>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold text-[var(--foreground)]">Documents</h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {meta.total} document{meta.total !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search issuer, doc number..."
                    className="pl-9 w-64"
                  />
                </div>
                <Button
                  icon={<Upload className="h-4 w-4" />}
                  onClick={() => router.push("/upload")}
                >
                  Upload
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        {isLoading ? (
          <>
            <Skeleton variant="rect" width="100%" height="44px" />
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rect" width="100%" height="48px" />
              ))}
            </div>
          </>
        ) : (
          <>
            <Tabs tabs={tabItems} activeTab={activeTab} onChange={handleTabChange} />

        {/* DataTable or empty state */}
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title={activeTab === "all" ? "No documents yet" : `No ${STATUS_TABS.find((t) => t.id === activeTab)?.label.toLowerCase() || ""} documents`}
            description={
              activeTab === "all"
                ? "Upload your first document to get started."
                : "No documents match this filter."
            }
            action={
              activeTab === "all"
                ? { label: "Upload Document", onClick: () => router.push("/upload") }
                : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            keyField="id"
            selectable={permissions.canApprove}
            onSelect={handleSelect}
            onRowClick={handleRowClick}
            onRowDoubleClick={handleRowDoubleClick}
            sortable
            emptyMessage="No documents found"
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

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="sticky bottom-4 flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-md)]">
            <span className="text-sm text-[var(--muted-foreground)]">
              {selectedIds.length} document{selectedIds.length !== 1 ? "s" : ""} selected
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircle className="h-4 w-4" />}
              loading={approve.isPending}
              onClick={handleBulkApprove}
            >
              Approve Selected
            </Button>
          </div>
        )}
          </>
        )}
      </div>

      {/* Side panel */}
      <DocumentSidePanel
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onAction={handleAction}
      />

      {/* Reject modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => {
          setRejectModal(null);
          setRejectComment("");
        }}
        title="Reject Document"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRejectModal(null);
                setRejectComment("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={reject.isPending}
              onClick={handleRejectConfirm}
            >
              Reject Document
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p>
            This document will be sent back to the maker for correction.
          </p>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Reason for rejection..."
            className="w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-2 focus:outline-[var(--ring)] focus:outline-offset-0"
            rows={3}
          />
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Document"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteDoc.isPending}
              onClick={handleDeleteConfirm}
            >
              Delete Permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          This document will be permanently deleted. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
