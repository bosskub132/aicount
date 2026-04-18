"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { UserSquare2, Plus, Upload, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { FileImport } from "@/components/file-import";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface CustomerRow {
  id: string;
  taxId: string;
  name: string;
  branchNumber: string | null;
  creditTermDays: number | null;
  [key: string]: unknown;
}

export default function MasterDataCustomersPage() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null);
  const [editTarget, setEditTarget] = useState<CustomerRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [branchNumber, setBranchNumber] = useState("");
  const [creditTermDays, setCreditTermDays] = useState("");

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

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch) sp.set("search", debouncedSearch);
      const response = await fetch(`/api/tenants/${tenantId}/customers?${sp}`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = (await response.json()) as { success: boolean; data?: CustomerRow[]; meta?: { total: number; totalPages: number }; error?: string };
      if (json.success) {
        setRows(json.data || []);
        setTotalPages(json.meta?.totalPages ?? 1);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, limit, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setName("");
    setTaxId("");
    setBranchNumber("");
    setCreditTermDays("");
    setEditTarget(null);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function openEditModal(row: CustomerRow) {
    setEditTarget(row);
    setName(row.name);
    setTaxId(row.taxId);
    setBranchNumber(row.branchNumber || "");
    setCreditTermDays(row.creditTermDays != null ? String(row.creditTermDays) : "");
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const response = await fetch(`/api/tenants/${tenantId}/customers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            id: editTarget.id,
            name,
            creditTermDays: creditTermDays ? Number(creditTermDays) : undefined,
            branchNumber: branchNumber || undefined,
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Customer updated");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Update failed");
        }
      } else {
        const response = await fetch(`/api/tenants/${tenantId}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            taxId,
            name,
            creditTermDays: creditTermDays ? Number(creditTermDays) : undefined,
            branchNumber: branchNumber || undefined,
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Customer created");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Create failed");
        }
      }
    } catch {
      toast.error("Failed to save customer");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/customers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ id }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Customer deleted");
        setDeleteTarget(null);
        await load();
      } else {
        toast.error(json.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete customer");
    } finally {
      setSaving(false);
    }
  }

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = String(a[sortKey as keyof CustomerRow] ?? "");
      const bVal = String(b[sortKey as keyof CustomerRow] ?? "");
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [rows, sortKey, sortDir]);

  const columns: Column<CustomerRow>[] = [
    { key: "name", header: "Name", sortable: true },
    {
      key: "taxId",
      header: "Tax ID",
      width: "160px",
      sortable: true,
      render: (row) => <span className="font-mono">{row.taxId}</span>,
    },
    {
      key: "branchNumber",
      header: "Branch",
      width: "120px",
      sortable: false,
      render: (row) => row.branchNumber || "\u2014",
    },
    {
      key: "creditTermDays",
      header: "Credit Terms",
      width: "130px",
      sortable: false,
      render: (row) => (
        <span className="tabular-nums">
          {row.creditTermDays != null ? `${row.creditTermDays} days` : "\u2014"}
        </span>
      ),
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
          <UserSquare2 className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Customers</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to manage customers.
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
        <UserSquare2 className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Customers</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage customer master data for accounts receivable.
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
          Add Customer
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
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <DataTable<CustomerRow>
          columns={columns}
          data={sorted}
          keyField="id"
          sortable
          onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
          emptyMessage={loading ? "Loading customers..." : "No customers found."}
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
        title={editTarget ? "Edit Customer" : "Add Customer"}
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
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Tax ID"
            required
            maxLength={13}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            disabled={!!editTarget}
          />
          <Input
            label="Branch Number"
            value={branchNumber}
            onChange={(e) => setBranchNumber(e.target.value)}
          />
          <Input
            label="Credit Term Days"
            type="number"
            placeholder="30"
            value={creditTermDays}
            onChange={(e) => setCreditTermDays(e.target.value)}
          />
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Customers"
        size="lg"
      >
        <FileImport
          entityType="customer"
          onImport={async (importedRows) => {
            const res = await fetch(`/api/tenants/${tenantId}/customers/batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
              body: JSON.stringify({ rows: importedRows }),
            });
            const json = (await res.json()) as { success: boolean; data?: { count: number }; error?: string };
            if (json.success) {
              toast.success(`Imported ${json.data?.count ?? 0} customers`);
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
        title="Delete Customer"
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
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong> (Tax ID: {deleteTarget?.taxId})?
        </p>
      </Modal>
    </section>
  );
}
