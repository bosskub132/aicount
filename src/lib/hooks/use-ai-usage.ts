import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

const isValidTenant = (id: string) =>
  !!id && id !== "00000000-0000-0000-0000-000000000000";

export function useTenantAiUsage() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["ai-usage", tenantId],
    queryFn: async () => {
      const res = await fetch("/api/settings/ai-usage", {
        headers: { "x-tenant-id": tenantId },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as {
        documentCount: number;
        totalCostUsd: number;
        avgCostPerDoc: number;
        tier1Count: number;
        tier2Count: number;
        tier3Count: number;
        costChange: number | null;
        budget: number | null;
        budgetAlertThreshold: number;
        budgetUsedPct: number | null;
      };
    },
    enabled: isValidTenant(tenantId),
  });
}
