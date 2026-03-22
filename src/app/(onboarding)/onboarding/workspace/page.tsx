"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";

interface TenantRow {
  tenantId: string;
  tenantName: string;
  taxId: string;
}

export default function OnboardingWorkspacePage() {
  const router = useRouter();

  const [existingTenantId, setExistingTenantId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill if user already has a tenant
  useEffect(() => {
    async function loadTenants() {
      try {
        const res = await fetch("/api/tenants");
        if (res.ok) {
          const json = (await res.json()) as { success: boolean; data: TenantRow[] };
          if (json.success && json.data.length > 0) {
            const first = json.data[0];
            setExistingTenantId(first.tenantId);
            setCompanyName(first.tenantName ?? "");
            setTaxId(first.taxId ?? "");
          }
        }
      } catch {
        // Ignore pre-fill errors
      } finally {
        setFetching(false);
      }
    }
    loadTenants();
  }, []);

  function handleTaxIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, "").slice(0, 13);
    setTaxId(value);
  }

  function validate(): string | null {
    if (!companyName.trim()) return "Company name is required.";
    if (taxId && taxId.length !== 13) return "Tax ID must be exactly 13 digits.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      let tenantId = existingTenantId;

      if (existingTenantId) {
        // Update existing tenant
        const res = await fetch(`/api/tenants/${existingTenantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: companyName.trim(), taxId }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? "Failed to update workspace.");
        }
      } else {
        // Create new tenant
        const res = await fetch("/api/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: companyName.trim(), taxId }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? "Failed to create workspace.");
        }
        const json = (await res.json()) as { success: boolean; data: { id: string } };
        tenantId = json.data.id;
      }

      // Persist tenantId locally for subsequent onboarding steps
      if (tenantId) {
        localStorage.setItem("workspaceTenantId", tenantId);
      }

      // Advance onboarding step
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingStep: 2 }),
      });

      router.push("/onboarding/chart-of-accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900">Create your workspace</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your company details to get started. You can update these later in Settings.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        {/* Company Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="companyName" className="text-sm font-medium text-slate-700">
            Company Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. บริษัท ตัวอย่าง จำกัด"
              required
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Tax ID */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="taxId" className="text-sm font-medium text-slate-700">
            Tax ID{" "}
            <span className="text-slate-400 font-normal">(optional — 13 digits)</span>
          </label>
          <div className="relative">
            <input
              id="taxId"
              type="text"
              inputMode="numeric"
              value={taxId}
              onChange={handleTaxIdChange}
              placeholder="0000000000000"
              maxLength={13}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-4 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {taxId.length}/13
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="submit"
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
      </form>
    </div>
  );
}
