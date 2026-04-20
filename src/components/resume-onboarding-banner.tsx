"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/button";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

const STEP_ROUTES = [
  "/onboarding",
  "/onboarding/workspace",
  "/onboarding/chart-of-accounts",
  "/onboarding/vendors-customers",
  "/onboarding/departments",
  "/onboarding/team",
  "/onboarding/template",
  "/onboarding/complete",
];

export function ResumeOnboardingBanner() {
  const router = useRouter();
  const [state, setState] = useState<{ tenantId: string; tenantName: string; step: number } | null>(null);

  useEffect(() => {
    async function check() {
      const currentId = getWorkspaceTenantId();
      if (!currentId) return;
      try {
        const tenantsRes = await fetch("/api/tenants", { credentials: "same-origin" });
        const tenantsJson = (await tenantsRes.json()) as {
          data?: Array<{ tenantId: string; tenantName: string; isOnboardingComplete: boolean }>;
        };
        const found = (tenantsJson.data ?? []).find((t) => t.tenantId === currentId);
        if (!found || found.isOnboardingComplete) return;

        const stateRes = await fetch(`/api/tenants/${currentId}/onboarding`);
        const stateJson = (await stateRes.json()) as { data?: { onboardingStep: number } };
        setState({
          tenantId: currentId,
          tenantName: found.tenantName,
          step: Math.max(0, Math.min(7, stateJson.data?.onboardingStep ?? 0)),
        });
      } catch {
        /* silent */
      }
    }
    void check();
  }, []);

  if (!state) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-light)] px-4 py-3">
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[var(--warning)]" />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--warning)]">
          Setup for {state.tenantName} is incomplete
        </p>
        <p className="text-xs text-[var(--warning)]">You&apos;re on step {state.step} of 8.</p>
      </div>
      <Button variant="primary" size="sm" onClick={() => router.push(STEP_ROUTES[state.step])}>
        Resume setup
      </Button>
    </div>
  );
}
