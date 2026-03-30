"use client";

import { useEffect, useState, useMemo } from "react";
import { Store, Plus, Upload, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Toggle } from "@/components/toggle";
import { FileImport } from "@/components/file-import";
import { useToast } from "@/lib/stores/ui-store";

interface VendorRow {
  id: string;
  taxId: string;
  name: string;
  vendorType: string;
  isNonResident: boolean;
  branchNumber: string | null;
  country: string | null;
  address: string | null;
  defaultExpenseGl: string | null;
  defaultWhtRate: string | null;
  [key: string]: unknown;
}

const VENDOR_TYPE_OPTIONS = [
  { value: "company", label: "Company" },
  { value: "individual", label: "Individual" },
];

const WHT_RATE_OPTIONS = [
  { value: "1", label: "1%" },
  { value: "2", label: "2%" },
  { value: "3", label: "3%" },
  { value: "5", label: "5%" },
  { value: "10", label: "10%" },
  { value: "15", label: "15%" },
];

export default function MasterDataVendorsPage() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VendorRow | null>(null);
  const [editTarget, setEditTarget] = useState<VendorRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [vendorType, setVendorType] = useState("company");
  const [branchNumber, setBranchNumber] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [isNonResident, setIsNonResident] = useState(false);
  const [defaultExpenseGl, setDefaultExpenseGl] = useState("");
  const [defaultWhtRate, setDefaultWhtRate] = useState("3");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/vendors`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = (await response.json()) as { success: boolean; data?: VendorRow[]; error?: string };
      if (json.success) {
        setRows(json.data || []);
      } else {
        toast.error(json.error || "Failed to load vendors");
      }
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function resetForm() {
    setName("");
    setTaxId("");
    setVendorType("company");
    setBranchNumber("");
    setAddress("");
    setCountry("");
    setIsNonResident(false);
    setDefaultExpenseGl("");
    setDefaultWhtRate("3");
    setEditTarget(null);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function openEditModal(row: VendorRow) {
    setEditTarget(row);
    setName(row.name);
    setTaxId(row.taxId);
    setVendorType(row.vendorType || "company");
    setBranchNumber(row.branchNumber || "");
    setAddress(row.address || "");
    setCountry(row.country || "");
    setIsNonResident(row.isNonResident ?? false);
    setDefaultExpenseGl(row.defaultExpenseGl || "");
    setDefaultWhtRate(row.defaultWhtRate || "3");
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const response = await fetch(`/api/tenants/${tenantId}/vendors`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            id: editTarget.id,
            taxId,
            name,
            vendorType,
            branchNumber: branchNumber || undefined,
            address: address || undefined,
            country: country || undefined,
            isNonResident,
            defaultExpenseGl: defaultExpenseGl || undefined,
            defaultWhtRate: Number(defaultWhtRate),
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Vendor updated");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Update failed");
        }
      } else {
        const response = await fetch(`/api/tenants/${tenantId}/vendors`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            taxId,
            name,
            vendorType,
            branchNumber: branchNumber || undefined,
            address: address || undefined,
            country: country || undefined,
            isNonResident,
            defaultExpenseGl: defaultExpenseGl || undefined,
            defaultWhtRate: Number(defaultWhtRate),
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Vendor created");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Create failed");
        }
      }
    } catch {
      toast.error("Failed to save vendor");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/vendors`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ id }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Vendor deleted");
        setDeleteTarget(null);
        await load();
      } else {
        toast.error(json.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete vendor");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.taxId.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns: Column<VendorRow>[] = [
    { key: "name", header: "Name", sortable: true },
    {
      key: "taxId",
      header: "Tax ID",
      width: "160px",
      sortable: true,
      render: (row) => <span className="font-mono">{row.taxId}</span>,
    },
    {
      key: "vendorType",
      header: "Type",
      width: "140px",
      render: (row) => (
        <Badge variant="default">
          {row.vendorType}{row.isNonResident ? " (NR)" : ""}
        </Badge>
      ),
    },
    {
      key: "branchNumber",
      header: "Branch",
      width: "100px",
      render: (row) => row.branchNumber || "\u2014",
    },
    {
      key: "defaultWhtRate",
      header: "WHT Rate",
      width: "100px",
      render: (row) => (
        <span className="tabular-nums">
          {row.defaultWhtRate ? `${row.defaultWhtRate}%` : "\u2014"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "100px",
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
          <Store className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Vendors</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to manage vendors.
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
        <Store className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Vendors</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage vendor master data for accounts payable and WHT.
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
          Add Vendor
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
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border)]">
        <DataTable<VendorRow>
          columns={columns}
          data={filtered}
          keyField="id"
          emptyMessage={loading ? "Loading vendors..." : "No vendors found."}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? "Edit Vendor" : "Add Vendor"}
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
          <Select
            label="Vendor Type"
            options={VENDOR_TYPE_OPTIONS}
            value={vendorType}
            onChange={(v) => setVendorType(v)}
          />
          <Input
            label="Branch Number"
            placeholder="00000 = Head Office"
            value={branchNumber}
            onChange={(e) => setBranchNumber(e.target.value)}
          />
          <Input
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Input
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <Toggle
            checked={isNonResident}
            onChange={setIsNonResident}
            label="Non-Resident Vendor"
          />
          <Input
            label="Default Expense GL"
            value={defaultExpenseGl}
            onChange={(e) => setDefaultExpenseGl(e.target.value)}
          />
          <Select
            label="Default WHT Rate"
            options={WHT_RATE_OPTIONS}
            value={defaultWhtRate}
            onChange={(v) => setDefaultWhtRate(v)}
          />
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Vendors"
        size="lg"
      >
        <FileImport
          entityType="vendor"
          onImport={async (importedRows) => {
            const res = await fetch(`/api/tenants/${tenantId}/vendors/batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
              body: JSON.stringify({ rows: importedRows }),
            });
            const json = (await res.json()) as { success: boolean; data?: { count: number }; error?: string };
            if (json.success) {
              toast.success(`Imported ${json.data?.count ?? 0} vendors`);
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
        title="Delete Vendor"
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
