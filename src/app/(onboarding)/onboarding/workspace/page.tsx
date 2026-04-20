"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { RadioGroup } from "@/components/radio-group";

interface TenantRow {
  tenantId: string;
  tenantName: string;
  taxId: string;
  industry?: string | null;
  companySize?: string | null;
}

function OnboardingWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewWorkspaceMode = searchParams.get("new") === "true";

  const [existingTenantId, setExistingTenantId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill if user already has a tenant — skip in "new workspace" mode
  useEffect(() => {
    if (isNewWorkspaceMode) {
      setFetching(false);
      return;
    }
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
            setIndustry(first.industry ?? "");
            setCompanySize(first.companySize ?? "");
          }
        }
      } catch {
        // Ignore pre-fill errors
      } finally {
        setFetching(false);
      }
    }
    loadTenants();
  }, [isNewWorkspaceMode]);

  function handleTaxIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, "").slice(0, 13);
    setTaxId(value);
  }

  function validate(): string | null {
    if (!companyName.trim()) return "Company name is required.";
    if (!taxId) return "Tax ID is required.";
    if (taxId.length !== 13) return "Tax ID must be exactly 13 digits.";
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

      if (existingTenantId && !isNewWorkspaceMode) {
        // Update existing tenant
        const res = await fetch(`/api/tenants/${existingTenantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: companyName.trim(), taxId, industry: industry || undefined, companySize: companySize || undefined }),
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
          body: JSON.stringify({ name: companyName.trim(), taxId, industry: industry || undefined, companySize: companySize || undefined }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? "Failed to create workspace.");
        }
        const json = (await res.json()) as { success: boolean; data: { id: string } };
        tenantId = json.data.id;
      }

      // Set tenant cookies server-side so middleware and subsequent onboarding
      // pages can resolve the tenant.
      if (tenantId) {
        const switchRes = await fetch("/api/workspace/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        });
        if (!switchRes.ok) {
          throw new Error("Couldn't activate the new workspace. Please try again.");
        }
      }

      // Advance onboarding step on the active tenant
      if (tenantId) {
        await fetch(`/api/tenants/${tenantId}/onboarding`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingStep: 2 }),
        });
      }

      router.push("/onboarding/chart-of-accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your workspace. Please try again.");
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
          required
          helperText={`${taxId.length}/13 digits`}
          value={taxId}
          onChange={handleTaxIdChange}
          maxLength={13}
          inputMode="numeric"
          placeholder="0000000000000"
        />

        {/* Industry */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
            ประเภทธุรกิจ (Industry)
          </label>
          <Select
            value={industry}
            onChange={setIndustry}
            placeholder="เลือกประเภทธุรกิจ"
            options={[
              { value: "retail", label: "ค้าปลีก (Retail)" },
              { value: "manufacturing", label: "การผลิต (Manufacturing)" },
              { value: "services", label: "บริการ (Services)" },
              { value: "construction", label: "ก่อสร้าง (Construction)" },
              { value: "hospitality", label: "โรงแรม/ร้านอาหาร (Hospitality)" },
              { value: "healthcare", label: "สุขภาพ (Healthcare)" },
              { value: "education", label: "การศึกษา (Education)" },
              { value: "technology", label: "เทคโนโลยี (Technology)" },
              { value: "other", label: "อื่นๆ (Other)" },
            ]}
          />
        </div>

        {/* Company Size */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
            ขนาดบริษัท (Company Size)
          </label>
          <RadioGroup
            name="companySize"
            value={companySize}
            onChange={setCompanySize}
            options={[
              { value: "micro", label: "Micro (1-5 คน)" },
              { value: "small", label: "Small (6-30 คน)" },
              { value: "medium", label: "Medium (31-200 คน)" },
              { value: "large", label: "Large (200+ คน)" },
            ]}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-[var(--radius-input)] border border-[var(--destructive)] bg-[var(--destructive-light)] px-4 py-3 text-sm text-[var(--destructive)] flex items-start justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 shrink-0 p-0.5 hover:opacity-70" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
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

export default function OnboardingWorkspacePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      }
    >
      <OnboardingWorkspacePage />
    </Suspense>
  );
}
