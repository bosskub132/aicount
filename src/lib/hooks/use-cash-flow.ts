import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId, isDefaultWorkspaceTenantId } from "@/components/workspace-selector";

interface CashFlowParams {
  period: string;
  scope: string;
  comparison?: string;
}

export function useCashFlow(params: CashFlowParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["cash-flow", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period, scope: params.scope });
      if (params.comparison) sp.set("comparison", params.comparison);
      const res = await fetch(`/api/tenants/${tenantId}/reports/cash-flow?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch cash flow");
      return json.data;
    },
    enabled: !!tenantId && !isDefaultWorkspaceTenantId(tenantId),
  });
}
