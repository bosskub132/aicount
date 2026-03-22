"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Layers, Plus, Trash2 } from "lucide-react";

interface Department {
  deptCode: string;
  deptName: string;
}

export default function OnboardingDepartmentsPage() {
  const router = useRouter();

  const [tenantId, setTenantId] = useState("");
  const [depts, setDepts] = useState<Department[]>([]);
  const [deptCode, setDeptCode] = useState("");
  const [deptName, setDeptName] = useState("");
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

    async function loadDepartments() {
      try {
        const res = await fetch(`/api/tenants/${tid}/departments`, {
          headers: { "x-tenant-id": tid },
        });
        if (res.ok) {
          const json = (await res.json()) as { success: boolean; data: Department[] };
          if (json.success && Array.isArray(json.data)) {
            setDepts(json.data);
          }
        }
      } catch {
        // Ignore load errors — user can still add departments
      } finally {
        setFetching(false);
      }
    }

    loadDepartments();
  }, []);

  function handleAddDepartment() {
    if (!deptCode.trim() || !deptName.trim()) return;
    setDepts((prev) => [
      ...prev,
      { deptCode: deptCode.trim(), deptName: deptName.trim() },
    ]);
    setDeptCode("");
    setDeptName("");
  }

  function handleRemove(index: number) {
    setDepts((prev) => prev.filter((_, i) => i !== index));
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
      if (depts.length > 0 && tenantId) {
        const res = await fetch(`/api/tenants/${tenantId}/departments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({ departments: depts }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? "Failed to save departments.");
        }
      }
      await patchOnboardingStep(4);
      router.push("/onboarding/team");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await patchOnboardingStep(4);
    router.push("/onboarding/team");
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
          <Layers className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500">Add cost centers and departments for your organization</p>
        </div>
      </div>

      {/* Form card */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm text-slate-600">
          Add your departments or cost centers below. You can always add or edit them later in Settings.
        </p>

        {/* Input row */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={deptCode}
            onChange={(e) => setDeptCode(e.target.value)}
            placeholder="Code (e.g. MKT)"
            className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="text"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            placeholder="Department name"
            className="flex-1 min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="button"
            onClick={handleAddDepartment}
            disabled={!deptCode.trim() || !deptName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {/* Departments table */}
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          {depts.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Code
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Department Name
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {depts.map((dept, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{dept.deptCode}</td>
                    <td className="px-4 py-2.5 text-slate-900">{dept.deptName}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(i)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove department"
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
                No departments added yet. You can add them here or later in Settings.
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
          onClick={() => router.push("/onboarding/chart-of-accounts")}
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
