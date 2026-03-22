"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileSpreadsheet } from "lucide-react";

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
      await patchOnboardingStep(6);
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Export Template</h1>
          <p className="text-sm text-slate-500">Configure your Express accounting export format</p>
        </div>
      </div>

      {/* Form card */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-5 text-sm text-slate-600">
          Choose an export template for Express accounting software, or skip to use the default.
        </p>

        {/* Radio options */}
        <div className="flex flex-col gap-3">
          <label
            className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-colors ${
              templateChoice === "default"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="template"
              value="default"
              checked={templateChoice === "default"}
              onChange={() => setTemplateChoice("default")}
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">Default Express Template</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Standard Express format with common journal types. Suitable for most Thai accounting workflows.
              </p>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-colors ${
              templateChoice === "custom"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="template"
              value="custom"
              checked={templateChoice === "custom"}
              onChange={() => setTemplateChoice("custom")}
              className="mt-0.5 accent-blue-600"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Custom Template</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Configure custom column mappings later in Settings.
              </p>
            </div>
          </label>
        </div>

        {/* Custom template name input */}
        {templateChoice === "custom" && (
          <div className="mt-4">
            <label htmlFor="customTemplateName" className="text-sm font-medium text-slate-700">
              Template Name <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="customTemplateName"
              type="text"
              value={customTemplateName}
              onChange={(e) => setCustomTemplateName(e.target.value)}
              placeholder="e.g. My Company Template"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}
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
          onClick={() => router.push("/onboarding/team")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="button"
          onClick={handleNext}
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
