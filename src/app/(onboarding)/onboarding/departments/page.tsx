"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Layers, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { FileImport } from "@/components/file-import";

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
  const [mode, setMode] = useState<"manual" | "import">("manual");

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
      await patchOnboardingStep(5);
      router.push("/onboarding/team");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await patchOnboardingStep(5);
    router.push("/onboarding/team");
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
          <Layers className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Departments</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Add cost centers and departments for your organization</p>
        </div>
      </div>

      {/* Form card */}
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Add your departments or cost centers below. You can always add or edit them later in Settings.
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
            entityType="department"
            onImport={async (rows) => {
              const tenantIdVal = tenantId;
              if (!tenantIdVal) return;
              const res = await fetch(`/api/tenants/${tenantIdVal}/departments/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-tenant-id": tenantIdVal },
                body: JSON.stringify({ rows }),
              });
              const json = await res.json();
              if (json.success) {
                // Reload departments list
                const loadRes = await fetch(`/api/tenants/${tenantIdVal}/departments`, {
                  headers: { "x-tenant-id": tenantIdVal },
                });
                const loadJson = await loadRes.json();
                if (loadJson.success) setDepts(loadJson.data || []);
                setMode("manual");
              }
            }}
          />
        ) : (
          <>
            {/* Input row */}
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Code (e.g. MKT)"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                className="w-32"
              />
              <Input
                placeholder="Department name"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                className="flex-1 min-w-40"
              />
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleAddDepartment}
                disabled={!deptCode.trim() || !deptName.trim()}
              >
                Add
              </Button>
            </div>
          </>
        )}

        {/* Departments table */}
        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-[var(--border)]">
          {depts.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Code
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Department Name
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {depts.map((dept, i) => (
                  <tr key={i} className="hover:bg-[var(--muted)]">
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{dept.deptCode}</td>
                    <td className="px-4 py-2.5 text-[var(--foreground)]">{dept.deptName}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(i)}
                        className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive-light)] hover:text-[var(--destructive)]"
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
              <p className="text-sm text-[var(--muted-foreground)]">
                No departments added yet. You can add them here or later in Settings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-[var(--destructive)] bg-[var(--destructive-light)] px-4 py-3 text-sm text-[var(--destructive)] flex items-start justify-between">
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
          onClick={() => router.push("/onboarding/vendors-customers")}
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
