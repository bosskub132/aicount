"use client";

import { useEffect, useState, useMemo } from "react";
import { Landmark, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Toggle } from "@/components/toggle";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { useToast } from "@/lib/stores/ui-store";

interface BankAccountRow {
  id: string;
  bankName: string;
  accountNumber: string;
  glAccountCode: string | null;
  [key: string]: unknown;
}

interface ReconSettings {
  amountTolerance: string;
  dateRangeDays: number;
  autoMatch: boolean;
  matchByReference: boolean;
}

const DEFAULT_SETTINGS: ReconSettings = {
  amountTolerance: "0.50",
  dateRangeDays: 3,
  autoMatch: true,
  matchByReference: true,
};

export default function BankReconSettingsPage() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");

  // Settings state
  const [settings, setSettings] = useState<ReconSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Bank accounts state
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BankAccountRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankAccountRow | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Form fields for bank account modal
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [glAccountCode, setGlAccountCode] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  // Load settings
  async function loadSettings() {
    if (!tenantId) return;
    setSettingsLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/bank-recon-settings`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = (await response.json()) as { success: boolean; data?: ReconSettings; error?: string };
      if (json.success && json.data) {
        setSettings({
          amountTolerance: json.data.amountTolerance,
          dateRangeDays: json.data.dateRangeDays,
          autoMatch: json.data.autoMatch,
          matchByReference: json.data.matchByReference,
        });
      }
    } catch {
      toast.error("Failed to load reconciliation settings");
    } finally {
      setSettingsLoading(false);
    }
  }

  // Load bank accounts
  async function loadAccounts() {
    if (!tenantId) return;
    setAccountsLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/bank-accounts`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = (await response.json()) as { success: boolean; data?: BankAccountRow[]; error?: string };
      if (json.success) {
        setAccounts(json.data || []);
      } else {
        toast.error(json.error || "Failed to load bank accounts");
      }
    } catch {
      toast.error("Failed to load bank accounts");
    } finally {
      setAccountsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Save matching rules
  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/bank-recon-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify(settings),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Matching rules saved");
      } else {
        toast.error(json.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  }

  // Bank account modal helpers
  function resetAccountForm() {
    setBankName("");
    setAccountNumber("");
    setGlAccountCode("");
    setEditTarget(null);
  }

  function closeModal() {
    setModalOpen(false);
    resetAccountForm();
  }

  function openEditModal(row: BankAccountRow) {
    setEditTarget(row);
    setBankName(row.bankName);
    setAccountNumber(row.accountNumber);
    setGlAccountCode(row.glAccountCode || "");
    setModalOpen(true);
  }

  async function handleSaveAccount() {
    setModalSaving(true);
    try {
      if (editTarget) {
        const response = await fetch(`/api/tenants/${tenantId}/bank-accounts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            id: editTarget.id,
            bankName,
            accountNumber,
            glAccountCode: glAccountCode || null,
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Bank account updated");
          closeModal();
          await loadAccounts();
        } else {
          toast.error(json.error || "Update failed");
        }
      } else {
        const response = await fetch(`/api/tenants/${tenantId}/bank-accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            bankName,
            accountNumber,
            glAccountCode: glAccountCode || null,
          }),
        });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (json.success) {
          toast.success("Bank account added");
          closeModal();
          await loadAccounts();
        } else {
          toast.error(json.error || "Create failed");
        }
      }
    } catch {
      toast.error("Failed to save bank account");
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDeleteAccount(id: string) {
    setModalSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/bank-accounts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ id }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Bank account removed");
        setDeleteTarget(null);
        await loadAccounts();
      } else {
        toast.error(json.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete bank account");
    } finally {
      setModalSaving(false);
    }
  }

  // Table columns
  const columns: Column<BankAccountRow>[] = useMemo(
    () => [
      { key: "bankName", header: "Bank Name", sortable: true },
      { key: "accountNumber", header: "Account Number", width: "180px", sortable: true },
      {
        key: "glAccountCode",
        header: "GL Account",
        width: "140px",
        sortable: false,
        render: (row) => (
          <span className="text-sm text-[var(--muted-foreground)]">
            {row.glAccountCode || "\u2014"}
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
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              Bank Reconciliation Settings
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to configure bank reconciliation.
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
        <Landmark className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Bank Reconciliation Settings
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Configure auto-matching rules and bank accounts.
          </p>
        </div>
      </div>

      {/* Card 1: Matching Rules */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Matching Rules</h3>

        {settingsLoading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading settings...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Amount Tolerance (฿)"
                type="number"
                step="0.01"
                min="0"
                value={settings.amountTolerance}
                onChange={(e) =>
                  setSettings({ ...settings, amountTolerance: e.target.value })
                }
              />
              <Input
                label="Date Range (days)"
                type="number"
                min="0"
                max="90"
                value={String(settings.dateRangeDays)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dateRangeDays: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>

            <div className="flex flex-wrap gap-8 pt-2">
              <Toggle
                checked={settings.autoMatch}
                onChange={(checked) =>
                  setSettings({ ...settings, autoMatch: checked })
                }
                label="Auto-match transactions"
              />
              <Toggle
                checked={settings.matchByReference}
                onChange={(checked) =>
                  setSettings({ ...settings, matchByReference: checked })
                }
                label="Match by reference number"
              />
            </div>
          </>
        )}
      </div>

      {/* Card 2: Bank Accounts */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Bank Accounts</h3>
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              resetAccountForm();
              setModalOpen(true);
            }}
          >
            Add Bank Account
          </Button>
        </div>

        <DataTable<BankAccountRow>
          columns={columns}
          data={accounts}
          keyField="id"
          emptyMessage={accountsLoading ? "Loading bank accounts..." : "No bank accounts configured."}
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          loading={settingsSaving}
          onClick={handleSaveSettings}
          disabled={settingsLoading}
        >
          Save Settings
        </Button>
      </div>

      {/* Create/Edit Bank Account Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? "Edit Bank Account" : "Add Bank Account"}
        actions={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={modalSaving}
              onClick={handleSaveAccount}
              disabled={!bankName.trim() || !accountNumber.trim()}
            >
              {editTarget ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Bank Name"
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g. Bangkok Bank, SCB, KBank"
          />
          <Input
            label="Account Number"
            required
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="e.g. 123-4-56789-0"
          />
          <Input
            label="GL Account Code"
            value={glAccountCode}
            onChange={(e) => setGlAccountCode(e.target.value)}
            placeholder="e.g. 1102"
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Bank Account"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={modalSaving}
              onClick={() => deleteTarget && handleDeleteAccount(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--foreground)]">
          Are you sure you want to remove <strong>{deleteTarget?.bankName}</strong> ({deleteTarget?.accountNumber})?
        </p>
      </Modal>
    </section>
  );
}
