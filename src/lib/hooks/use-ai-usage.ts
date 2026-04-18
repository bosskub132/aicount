import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export function useTenantAiUsage() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["ai-usage", tenantId],
    queryFn: async () => {
      const res = await fetch("/api/settings/ai-usage");
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
        suggestionsEnabled: boolean;
      };
    },
    enabled: !!tenantId,
  });
}
