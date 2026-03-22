"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Plus, Trash2 } from "lucide-react";

interface CoaRow {
  accountCode: string;
  accountName: string;
  category: string;
}

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
      { accountCode: accountCode.trim(), accountName: accountName.trim(), category },
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
      if (coaRows.length > 0 && tenantId) {
        const res = await fetch(`/api/tenants/${tenantId}/coa`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({ accounts: coaRows }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? "Failed to save chart of accounts.");
        }
      }
      await patchOnboardingStep(3);
      router.push("/onboarding/departments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await patchOnboardingStep(3);
    router.push("/onboarding/departments");
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <BookOpen className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chart of Accounts</h1>
          <p className="text-sm text-slate-500">Import your account codes and categories</p>
        </div>
      </div>

      {/* Form card */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm text-slate-600">
          Add your account codes below. You can always add or edit accounts later in Settings.
        </p>

        {/* Input row */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            placeholder="Code (e.g. 1100)"
            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Account name"
            className="flex-1 min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
          </select>
          <button
            type="button"
            onClick={handleAddEntry}
            disabled={!accountCode.trim() || !accountName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {/* Accounts table */}
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          {coaRows.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Code
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Account Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Category
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coaRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{row.accountCode}</td>
                    <td className="px-4 py-2.5 text-slate-900">{row.accountName}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(i)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
              <p className="text-sm text-slate-400">
                No accounts added yet. You can add them here or later in Settings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/onboarding/workspace")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          I&apos;ll do this later
        </button>

        <button
          type="button"
          onClick={saveAndNext}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving…
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
