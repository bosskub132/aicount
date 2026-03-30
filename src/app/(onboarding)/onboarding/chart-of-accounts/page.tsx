"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { FileImport } from "@/components/file-import";

interface CoaRow {
  accountCode: string;
  accountName: string;
  category: string;
}

const CATEGORY_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
];

export default function OnboardingChartOfAccountsPage() {
  const router = useRouter();

  const [tenantId, setTenantId] = useState("");
  const [coaRows, setCoaRows] = useState<CoaRow[]>([]);
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [category, setCategory] = useState("expense");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "import">("manual");

  useEffect(() => {
    const tid = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(tid);

    if (!tid) {
      setFetching(false);
      return;
    }

    async function loadCoa() {
      try {
        const res = await fetch(`/api/tenants/${tid}/coa`, {
          headers: { "x-tenant-id": tid },
        });
        if (res.ok) {
          const json = (await res.json()) as { success: boolean; data: CoaRow[] };
          if (json.success && Array.isArray(json.data)) {
            setCoaRows(json.data);
          }
        }
      } catch {
        // Ignore load errors — user can still add accounts
      } finally {
        setFetching(false);
      }
    }

    loadCoa();
  }, []);

  function handleAddEntry() {
    if (!accountCode.trim() || !accountName.trim()) return;
    setCoaRows((prev) => [
      ...prev,
      { accountCode: accountCode.trim(), accountName: accountName.trim(), category, _local: true },
    ]);
    setAccountCode("");
    setAccountName("");
    setCategory("expense");
  }

  function handleRemove(index: number) {
    setCoaRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function patchOnboardingStep(step: number) {
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: step }),
    });
  }

  async function saveAndNext() {
    setError(null);
    setLoading(true);
    try {
      // Save any locally-added rows that haven't been persisted yet
      const unsavedRows = coaRows.filter((r: Record<string, unknown>) => (r as Record<string, unknown>)._local);
      if (unsavedRows.length > 0 && tenantId) {
        const res = await fetch(`/api/tenants/${tenantId}/coa/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({ rows: unsavedRows }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? "Failed to save chart of accounts.");
        }
      }
      await patchOnboardingStep(3);
      router.push("/onboarding/vendors-customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await patchOnboardingStep(3);
    router.push("/onboarding/vendors-customers");
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)]">
          <BookOpen className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Chart of Accounts</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Import your account codes and categories</p>
        </div>
      </div>

      {/* Form card */}
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Add your account codes below. You can always add or edit accounts later in Settings.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <Button variant={mode === "manual" ? "primary" : "secondary"} size="sm" onClick={() => setMode("manual")}>
            Manual Entry
          </Button>
          <Button variant={mode === "import" ? "primary" : "secondary"} size="sm" onClick={() => setMode("import")}>
            Import File
          </Button>
        </div>

        {mode === "import" ? (
          <FileImport
            entityType="coa"
            onImport={async (rows) => {
              const tenantIdVal = tenantId;
              if (!tenantIdVal) return;
              const res = await fetch(`/api/tenants/${tenantIdVal}/coa/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-tenant-id": tenantIdVal },
                body: JSON.stringify({ rows }),
              });
              const json = await res.json();
              if (json.success) {
                // Reload COA list
                const loadRes = await fetch(`/api/tenants/${tenantIdVal}/coa`, {
                  headers: { "x-tenant-id": tenantIdVal },
                });
                const loadJson = await loadRes.json();
                if (loadJson.success) setCoaRows(loadJson.data || []);
                setMode("manual");
              }
            }}
          />
        ) : (
          <>
            {/* Input row */}
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Code (e.g. 1100)"
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                className="w-28"
              />
              <Input
                placeholder="Account name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="flex-1 min-w-40"
              />
              <Select
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={setCategory}
              />
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleAddEntry}
                disabled={!accountCode.trim() || !accountName.trim()}
              >
                Add
              </Button>
            </div>
          </>
        )}

        {/* Accounts table */}
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]">
          {coaRows.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Code
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Account Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Category
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {coaRows.map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--muted)]">
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{row.accountCode}</td>
                    <td className="px-4 py-2.5 text-[var(--foreground)]">{row.accountName}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--muted-foreground)]">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(i)}
                        className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive-light)] hover:text-[var(--destructive)]"
                        aria-label="Remove account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                No accounts added yet. You can add them here or later in Settings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start justify-between rounded-lg border border-[var(--destructive)] bg-[var(--destructive-light)] px-4 py-3 text-sm text-[var(--destructive)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 shrink-0 p-0.5 hover:opacity-70" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => router.push("/onboarding/workspace")}
        >
          Back
        </Button>

        <Button variant="link" onClick={handleSkip}>
          I&apos;ll do this later
        </Button>

        <Button
          variant="primary"
          loading={loading}
          icon={<ArrowRight className="h-4 w-4" />}
          onClick={saveAndNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
