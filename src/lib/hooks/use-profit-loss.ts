import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface ProfitLossParams {
  period: string;
  scope: string;
  department?: string;
  comparison?: string;
}

export const profitLossKeys = {
  detail: (tenantId: string, params: ProfitLossParams) =>
    ["profit-loss", tenantId, params] as const,
};

export function useProfitLoss(params: ProfitLossParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: profitLossKeys.detail(tenantId, params),
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period, scope: params.scope });
      if (params.department) sp.set("department", params.department);
      if (params.comparison) sp.set("comparison", params.comparison);
      const res = await fetch(`/api/tenants/${tenantId}/reports/profit-loss?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch profit & loss");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
