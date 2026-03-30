"use client";

import { useEffect, useState, useMemo } from "react";
import { Layers, Plus, Upload, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { FileImport } from "@/components/file-import";
import { useToast } from "@/lib/stores/ui-store";

interface DepartmentRow {
  id: string;
  deptCode: string;
  deptName: string;
  [key: string]: unknown;
}

export default function MasterDataDepartmentsPage() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentRow | null>(null);
  const [editTarget, setEditTarget] = useState<DepartmentRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [deptCode, setDeptCode] = useState("");
  const [deptName, setDeptName] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/departments`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = (await response.json()) as { success: boolean; data?: DepartmentRow[]; error?: string };
      if (json.success) {
        setRows(json.data || []);
      } else {
        toast.error(json.error || "Failed to load departments");
      }
    } catch {
      toast.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function resetForm() {
    setDeptCode("");
    setDeptName("");
    setEditTarget(null);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function openEditModal(row: DepartmentRow) {
    setEditTarget(row);
    setDeptCode(row.deptCode);
    setDeptName(row.deptName);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const response = await fetch(`/api/tenants/${tenantId}/departments`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            id: editTarget.id,
            deptName,
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Department updated");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Update failed");
        }
      } else {
        const response = await fetch(`/api/tenants/${tenantId}/departments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({ deptCode, deptName }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Department created");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Create failed");
        }
      }
    } catch {
      toast.error("Failed to save department");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/departments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ id }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Department deleted");
        setDeleteTarget(null);
        await load();
      } else {
        toast.error(json.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete department");
    } finally {
      setSaving(false);
    }
  }

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) => r.deptCode.toLowerCase().includes(q) || r.deptName.toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = String(a[sortKey as keyof DepartmentRow] ?? "");
        const bVal = String(b[sortKey as keyof DepartmentRow] ?? "");
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return result;
  }, [rows, search, sortKey, sortDir]);

  const columns: Column<DepartmentRow>[] = [
    { key: "deptCode", header: "Code", width: "120px", sortable: true },
    { key: "deptName", header: "Name", sortable: true },
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
          <Layers className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Departments</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to manage departments.
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
        <Layers className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Departments</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage department and cost center data.
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
          Add Department
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
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <DataTable<DepartmentRow>
          columns={columns}
          data={filtered}
          keyField="id"
          sortable
          onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
          emptyMessage={loading ? "Loading departments..." : "No departments found."}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? "Edit Department" : "Add Department"}
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
            label="Department Code"
            required
            value={deptCode}
            onChange={(e) => setDeptCode(e.target.value)}
            disabled={!!editTarget}
          />
          <Input
            label="Department Name"
            required
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
          />
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Departments"
        size="lg"
      >
        <FileImport
          entityType="department"
          onImport={async (importedRows) => {
            const res = await fetch(`/api/tenants/${tenantId}/departments/batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
              body: JSON.stringify({ rows: importedRows }),
            });
            const json = (await res.json()) as { success: boolean; data?: { count: number }; error?: string };
            if (json.success) {
              toast.success(`Imported ${json.data?.count ?? 0} departments`);
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
        title="Delete Department"
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
          Are you sure you want to delete <strong>{deleteTarget?.deptCode}</strong> &mdash;{" "}
          {deleteTarget?.deptName}?
        </p>
      </Modal>
    </section>
  );
}
