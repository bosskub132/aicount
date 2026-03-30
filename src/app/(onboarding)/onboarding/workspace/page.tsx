"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Create your workspace</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Enter your company details to get started. You can update these later in Settings.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        {/* Company Name */}
        <Input
          label="Company Name"
          required
          placeholder="e.g. บริษัท ตัวอย่าง จำกัด"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        {/* Tax ID */}
        <Input
          label="Tax ID"
          helperText={`${taxId.length}/13 digits (optional)`}
          value={taxId}
          onChange={handleTaxIdChange}
          maxLength={13}
          inputMode="numeric"
          placeholder="0000000000000"
        />

        {/* Error */}
        {error && (
          <div className="rounded-[var(--radius-input)] border border-[var(--destructive)] bg-[var(--destructive-light)] px-4 py-3 text-sm text-[var(--destructive)]">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => router.push("/onboarding")}
            type="button"
          >
            Back
          </Button>

          <Button
            variant="primary"
            loading={loading}
            icon={<ArrowRight className="h-4 w-4" />}
            type="submit"
          >
            Next
          </Button>
        </div>
      </form>
    </div>
  );
}
