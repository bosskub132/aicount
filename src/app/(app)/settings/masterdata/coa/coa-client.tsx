"use client";

import { useEffect, useState, useMemo } from "react";
import { BookOpen, Plus, Upload, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Toggle } from "@/components/toggle";

import { FileImport } from "@/components/file-import";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { useCoaList } from "@/lib/hooks/use-master-data";

type CoaCategory = "asset" | "liability" | "equity" | "revenue" | "expense";

interface CoaRow {
  id: string;
  accountCode: string;
  accountName: string;
  category: CoaCategory;
  isSuspense: boolean;
  [key: string]: unknown;
}

const CATEGORY_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
];

export default function CoaClient() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CoaRow | null>(null);
  const [editTarget, setEditTarget] = useState<CoaRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [category, setCategory] = useState<CoaCategory>("expense");
  const [isSuspense, setIsSuspense] = useState(false);

  useEffect(() => {
    const id = getWorkspaceTenantId();
    setTenantId(id);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useCoaList({
    page,
    limit,
    search: debouncedSearch || undefined,
  });
  const rows = (query.data?.data ?? []) as CoaRow[];
  const totalPages = query.data?.meta?.totalPages ?? 1;
  const loading = query.isLoading;
  const load = async () => {
    await query.refetch();
  };

  function resetForm() {
    setAccountCode("");
    setAccountName("");
    setCategory("expense");
    setIsSuspense(false);
    setEditTarget(null);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function openEditModal(row: CoaRow) {
    setEditTarget(row);
    setAccountCode(row.accountCode);
    setAccountName(row.accountName);
    setCategory(row.category);
    setIsSuspense(Boolean(row.isSuspense));
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const response = await fetch(`/api/tenants/${tenantId}/coa`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editTarget.id,
            accountName,
            category,
            isSuspense,
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Account updated");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Update failed");
        }
      } else {
        const response = await fetch(`/api/tenants/${tenantId}/coa`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountCode, accountName, category, isSuspense }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Account created");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Create failed");
        }
      }
    } catch {
      toast.error("Failed to save account");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/coa`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Account deleted");
        setDeleteTarget(null);
        await load();
      } else {
        toast.error(json.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setSaving(false);
    }
  }

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = String(a[sortKey as keyof CoaRow] ?? "");
      const bVal = String(b[sortKey as keyof CoaRow] ?? "");
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [rows, sortKey, sortDir]);

  const columns: Column<CoaRow>[] = [
    { key: "accountCode", header: "Code", width: "120px", sortable: true },
    { key: "accountName", header: "Account Name", sortable: true },
    {
      key: "category",
      header: "Category",
      width: "120px",
      sortable: false,
      render: (row) => <Badge variant="default">{row.category}</Badge>,
    },
    {
      key: "isSuspense",
      header: "Suspense",
      width: "100px",
      sortable: false,
      render: (row) => (row.isSuspense ? "Yes" : "\u2014"),
    },
    {
      key: "actions",
      header: "",
      width: "100px",
      sortable: false,
      render: (row) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(row);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-3.5 w-3.5 text-[var(--destructive)]" />}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
          />
        </div>
      ),
    },
  ];

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Chart of Accounts</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to manage chart of accounts.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Chart of Accounts</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your account codes and categories.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
        >
          Add Account
        </Button>
        <Button
          variant="secondary"
          icon={<Upload className="h-4 w-4" />}
          onClick={() => setImportOpen(true)}
        >
          Import
        </Button>
        <div className="ml-auto w-64">
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <DataTable<CoaRow>
          columns={columns}
          data={sorted}
          keyField="id"
          sortable
          onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
          emptyMessage={loading ? "Loading accounts..." : "No accounts found."}
        />
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        perPage={limit}
        onPerPageChange={(n) => { setLimit(n); setPage(1); }}
      />

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? "Edit Account" : "Add Account"}
        actions={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editTarget ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Account Code"
            required
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            disabled={!!editTarget}
          />
          <Input
            label="Account Name"
            required
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(v) => setCategory(v as CoaCategory)}
          />
          <div>
            <Toggle checked={isSuspense} onChange={setIsSuspense} label="Suspense Account" />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Temporarily holds transactions when the correct account is unknown.
            </p>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Chart of Accounts"
        size="lg"
      >
        <FileImport
          entityType="coa"
          onImport={async (importedRows) => {
            const res = await fetch(`/api/tenants/${tenantId}/coa/batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rows: importedRows }),
            });
            const json = (await res.json()) as { success: boolean; data?: { count: number }; error?: string };
            if (json.success) {
              toast.success(`Imported ${json.data?.count ?? 0} accounts`);
              setImportOpen(false);
              await load();
            } else {
              toast.error(json.error || "Import failed");
            }
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Account"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={saving}
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to delete <strong>{deleteTarget?.accountCode}</strong> &mdash;{" "}
          {deleteTarget?.accountName}?
        </p>
      </Modal>
    </section>
  );
}
