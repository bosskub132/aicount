"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileSpreadsheet,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Modal } from "@/components/modal";
import { Badge } from "@/components/badge";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type ColumnMapping = {
  position: number;
  header: string;
  sourceField: string;
  format?: string;
  defaultValue?: string;
};

interface ExportTemplate {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  columnMappings: ColumnMapping[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

const SOURCE_FIELDS = [
  { value: "date", label: "Journal Date" },
  { value: "jvNumber", label: "JV Number" },
  { value: "accountCode", label: "Account Code" },
  { value: "accountName", label: "Account Name" },
  { value: "debit", label: "Debit" },
  { value: "credit", label: "Credit" },
  { value: "description", label: "Description" },
  { value: "deptCode", label: "Department" },
  { value: "documentNumber", label: "Document Number" },
  { value: "documentDate", label: "Document Date" },
  { value: "vendorCustomer", label: "Vendor/Customer" },
  { value: "taxId", label: "Tax ID" },
];

const DEFAULT_COLUMN_MAPPINGS: ColumnMapping[] = SOURCE_FIELDS.map(
  (f, i) => ({
    position: i + 1,
    header: f.label,
    sourceField: f.value,
    format: "",
    defaultValue: "",
  })
);

export default function AccountingTemplatesPage() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExportTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExportTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [templateName, setTemplateName] = useState("");
  const [columns, setColumns] = useState<ColumnMapping[]>([]);

  useEffect(() => {
    const id = getWorkspaceTenantId();
    setTenantId(id);
  }, []);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/custom-export-templates`
      );
      const json = (await response.json()) as {
        success: boolean;
        data?: ExportTemplate[];
        error?: string;
      };
      if (json.success) {
        let data = json.data || [];
        // Auto-create default template if none exist
        if (data.length === 0) {
          const createRes = await fetch(
            `/api/tenants/${tenantId}/custom-export-templates`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: "Default Express",
                columnMappings: DEFAULT_COLUMN_MAPPINGS,
                isActive: true,
              }),
            }
          );
          const createJson = (await createRes.json()) as {
            success: boolean;
            data?: ExportTemplate;
          };
          if (createJson.success && createJson.data) {
            data = [createJson.data];
          }
        }
        setTemplates(data);
      } else {
        toast.error(json.error || "Failed to load templates");
      }
    } catch {
      toast.error("Failed to load export templates");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function resetForm() {
    setTemplateName("");
    setColumns([
      {
        position: 1,
        header: "",
        sourceField: "date",
        format: "",
        defaultValue: "",
      },
    ]);
    setEditTarget(null);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(t: ExportTemplate) {
    setEditTarget(t);
    setTemplateName(t.name);
    setColumns(
      (t.columnMappings || []).map((c, i) => ({
        ...c,
        position: i + 1,
      }))
    );
    setModalOpen(true);
  }

  function addColumn() {
    setColumns((prev) => [
      ...prev,
      {
        position: prev.length + 1,
        header: "",
        sourceField: "date",
        format: "",
        defaultValue: "",
      },
    ]);
  }

  function removeColumn(index: number) {
    setColumns((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((c, i) => ({ ...c, position: i + 1 }))
    );
  }

  function updateColumn(
    index: number,
    field: keyof ColumnMapping,
    value: string | number
  ) {
    setColumns((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function moveColumn(index: number, direction: "up" | "down") {
    setColumns((prev) => {
      const arr = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= arr.length) return prev;
      [arr[index], arr[swapIndex]] = [arr[swapIndex], arr[index]];
      return arr.map((c, i) => ({ ...c, position: i + 1 }));
    });
  }

  async function handleSave() {
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (columns.length === 0) {
      toast.error("At least one column is required");
      return;
    }
    const emptyHeaders = columns.some((c) => !c.header.trim());
    if (emptyHeaders) {
      toast.error("All columns must have a header");
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        const response = await fetch(
          `/api/tenants/${tenantId}/custom-export-templates`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: editTarget.id,
              name: templateName,
              columnMappings: columns,
            }),
          }
        );
        const json = (await response.json()) as {
          success: boolean;
          error?: string;
        };
        if (json.success) {
          toast.success("Template updated");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Update failed");
        }
      } else {
        const response = await fetch(
          `/api/tenants/${tenantId}/custom-export-templates`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: templateName,
              columnMappings: columns,
            }),
          }
        );
        const json = (await response.json()) as {
          success: boolean;
          error?: string;
        };
        if (json.success) {
          toast.success("Template created");
          closeModal();
          await load();
        } else {
          toast.error(json.error || "Create failed");
        }
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/custom-export-templates`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, isActive: true }),
        }
      );
      const json = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (json.success) {
        toast.success("Template activated");
        await load();
      } else {
        toast.error(json.error || "Activation failed");
      }
    } catch {
      toast.error("Failed to activate template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/custom-export-templates`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id }),
        }
      );
      const json = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (json.success) {
        toast.success("Template deleted");
        setDeleteTarget(null);
        await load();
      } else {
        toast.error(json.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setSaving(false);
    }
  }

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              Export Templates
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to manage export
              templates.
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
        <FileSpreadsheet className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Export Templates
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Configure column mappings for accounting exports.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Create Template
        </Button>
      </div>

      {/* Template Cards Grid */}
      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Loading templates...
        </p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No templates found.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {t.name}
                </h3>
                <Badge variant={t.isActive ? "approved" : "default"}>
                  {t.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {(t.columnMappings || []).length} columns
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => openEdit(t)}
                >
                  Edit
                </Button>
                {!t.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleActivate(t.id)}
                  >
                    Activate
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={
                    <Trash2 className="h-3.5 w-3.5 text-[var(--destructive)]" />
                  }
                  onClick={() => setDeleteTarget(t)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? "Edit Template" : "Create Template"}
        size="xl"
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
            label="Template Name"
            required
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. Express Standard"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--foreground)]">
                Column Mappings
              </label>
              <Button variant="ghost" size="sm" onClick={addColumn}>
                + Add Column
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {columns.map((col, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-primary)] p-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-badge)] bg-[var(--muted)] text-xs font-medium text-[var(--muted-foreground)]">
                    {col.position}
                  </span>

                  <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input
                      placeholder="Column header"
                      value={col.header}
                      onChange={(e) =>
                        updateColumn(index, "header", e.target.value)
                      }
                    />
                    <Select
                      options={SOURCE_FIELDS}
                      value={col.sourceField}
                      onChange={(v) => updateColumn(index, "sourceField", v)}
                      placeholder="Source field"
                    />
                    <Input
                      placeholder="e.g. DD/MM/YYYY"
                      value={col.format || ""}
                      onChange={(e) =>
                        updateColumn(index, "format", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Fallback"
                      value={col.defaultValue || ""}
                      onChange={(e) =>
                        updateColumn(index, "defaultValue", e.target.value)
                      }
                    />
                  </div>

                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-30 cursor-pointer"
                      disabled={index === 0}
                      onClick={() => moveColumn(index, "up")}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-30 cursor-pointer"
                      disabled={index === columns.length - 1}
                      onClick={() => moveColumn(index, "down")}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-[var(--destructive)] hover:bg-[var(--destructive-light)] cursor-pointer"
                    onClick={() => removeColumn(index)}
                    aria-label="Remove column"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Template"
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
          Are you sure you want to delete{" "}
          <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </section>
  );
}
