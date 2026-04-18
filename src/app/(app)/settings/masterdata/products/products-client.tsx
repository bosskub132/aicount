"use client";

import { useEffect, useState, useMemo } from "react";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { useProductsList } from "@/lib/hooks/use-master-data";

interface ProductRow {
  id: string;
  itemCode: string;
  itemName: string;
  keywords: string[] | null;
  incomeGl: string | null;
  expenseGl: string | null;
  [key: string]: unknown;
}

export default function ProductsClient() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [editTarget, setEditTarget] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [incomeGl, setIncomeGl] = useState("");
  const [expenseGl, setExpenseGl] = useState("");

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

  const query = useProductsList({
    page,
    limit,
    search: debouncedSearch || undefined,
  });
  const rows = (query.data?.data ?? []) as ProductRow[];
  const totalPages = query.data?.meta?.totalPages ?? 1;
  const loading = query.isLoading;
  const load = async () => {
    await query.refetch();
  };

  function resetForm() {
    setItemCode("");
    setItemName("");
    setKeywords("");
    setIncomeGl("");
    setExpenseGl("");
    setEditTarget(null);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function openEditModal(row: ProductRow) {
    setEditTarget(row);
    setItemCode(row.itemCode);
    setItemName(row.itemName);
    setKeywords((row.keywords || []).join(", "));
    setIncomeGl(row.incomeGl || "");
    setExpenseGl(row.expenseGl || "");
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const keywordsArray = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      if (editTarget) {
        const response = await fetch(`/api/tenants/${tenantId}/products`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editTarget.id,
            itemName,
            keywords: keywordsArray,
            incomeGl: incomeGl || undefined,
            expenseGl: expenseGl || undefined,
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Product updated");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Update failed");
        }
      } else {
        const response = await fetch(`/api/tenants/${tenantId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemCode,
            itemName,
            keywords: keywordsArray,
            incomeGl: incomeGl || undefined,
            expenseGl: expenseGl || undefined,
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Product created");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Create failed");
        }
      }
    } catch {
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/products`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Product deleted");
        setDeleteTarget(null);
        await load();
      } else {
        toast.error(json.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setSaving(false);
    }
  }

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = String(a[sortKey as keyof ProductRow] ?? "");
      const bVal = String(b[sortKey as keyof ProductRow] ?? "");
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [rows, sortKey, sortDir]);

  const columns: Column<ProductRow>[] = [
    { key: "itemCode", header: "Code", width: "120px", sortable: true },
    { key: "itemName", header: "Name", sortable: true },
    {
      key: "keywords",
      header: "Keywords",
      width: "200px",
      sortable: false,
      render: (row) => {
        const kw = row.keywords;
        return kw && kw.length > 0 ? kw.join(", ") : "\u2014";
      },
    },
    {
      key: "incomeGl",
      header: "Income GL",
      width: "120px",
      sortable: false,
      render: (row) => row.incomeGl || "\u2014",
    },
    {
      key: "expenseGl",
      header: "Expense GL",
      width: "120px",
      sortable: false,
      render: (row) => row.expenseGl || "\u2014",
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
          <Package className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Products</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to manage products.
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
        <Package className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Products</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Products map line item descriptions (from OCR) to GL account codes using keyword
            matching. When a document is processed, the system checks line item text against product
            keywords to suggest the correct income or expense account.
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
          Add Product
        </Button>
        <div className="ml-auto w-64">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <DataTable<ProductRow>
          columns={columns}
          data={sorted}
          keyField="id"
          sortable
          onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
          emptyMessage={loading ? "Loading products..." : "No products found."}
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
        title={editTarget ? "Edit Product" : "Add Product"}
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
            label="Item Code"
            required
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value)}
            disabled={!!editTarget}
          />
          <Input
            label="Item Name"
            required
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
          <Input
            label="Keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            helperText="Comma-separated keywords for matching OCR line items"
          />
          <Input
            label="Income GL Account"
            value={incomeGl}
            onChange={(e) => setIncomeGl(e.target.value)}
          />
          <Input
            label="Expense GL Account"
            value={expenseGl}
            onChange={(e) => setExpenseGl(e.target.value)}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
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
          Are you sure you want to delete <strong>{deleteTarget?.itemCode}</strong> &mdash;{" "}
          {deleteTarget?.itemName}?
        </p>
      </Modal>
    </section>
  );
}
