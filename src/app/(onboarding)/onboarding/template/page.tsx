"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

export default function OnboardingTemplatePage() {
  const router = useRouter();

  const [tenantId, setTenantId] = useState("");
  const [templateChoice, setTemplateChoice] = useState<"default" | "custom">("default");
  const [customTemplateName, setCustomTemplateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tid = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(tid);
  }, []);

  async function patchOnboardingStep(step: number) {
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: step }),
    });
  }

  async function handleNext() {
    setError(null);
    setLoading(true);
    try {
      if (tenantId) {
        const body: { type: string; name?: string } = { type: templateChoice };
        if (templateChoice === "custom" && customTemplateName.trim()) {
          body.name = customTemplateName.trim();
        }
        const res = await fetch(`/api/tenants/${tenantId}/templates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          // Non-fatal — template endpoint may not be implemented yet
          if (res.status !== 404) {
            throw new Error(json.error ?? "Failed to save template selection.");
          }
        }
      }
      await patchOnboardingStep(7);
      router.push("/onboarding/complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)]">
          <FileSpreadsheet className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Export Template</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Configure your Express accounting export format</p>
        </div>
      </div>

      {/* Form card */}
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
        <p className="mb-5 text-sm text-[var(--muted-foreground)]">
          Choose an export template for Express accounting software, or skip to use the default.
        </p>

        {/* Radio options */}
        <div className="flex flex-col gap-3">
          <label
            className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-colors ${
              templateChoice === "default"
                ? "border-[var(--primary)] bg-[var(--primary-light)]"
                : "border-[var(--border)] hover:border-[var(--border)] hover:bg-[var(--muted)]"
            }`}
          >
            <input
              type="radio"
              name="template"
              value="default"
              checked={templateChoice === "default"}
              onChange={() => setTemplateChoice("default")}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Default Express Template</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Standard Express format with common journal types. Suitable for most Thai accounting workflows.
              </p>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-colors ${
              templateChoice === "custom"
                ? "border-[var(--primary)] bg-[var(--primary-light)]"
                : "border-[var(--border)] hover:border-[var(--border)] hover:bg-[var(--muted)]"
            }`}
          >
            <input
              type="radio"
              name="template"
              value="custom"
              checked={templateChoice === "custom"}
              onChange={() => setTemplateChoice("custom")}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">Custom Template</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Configure custom column mappings later in Settings.
              </p>
            </div>
          </label>
        </div>

        {/* Custom template name input */}
        {templateChoice === "custom" && (
          <div className="mt-4">
            <Input
              label="Template Name"
              id="customTemplateName"
              value={customTemplateName}
              onChange={(e) => setCustomTemplateName(e.target.value)}
              placeholder="e.g. My Company Template"
              helperText="Optional"
            />
          </div>
        )}
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
          onClick={() => router.push("/onboarding/team")}
        >
          Back
        </Button>

        <Button
          variant="primary"
          loading={loading}
          icon={<ArrowRight className="h-4 w-4" />}
          onClick={handleNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
