import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface CashFlowParams {
  period: string;
  scope: string;
  comparison?: string;
}

export const cashFlowKeys = {
  detail: (tenantId: string, params: CashFlowParams) =>
    ["cash-flow", tenantId, params] as const,
};

export function useCashFlow(params: CashFlowParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: cashFlowKeys.detail(tenantId, params),
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period, scope: params.scope });
      if (params.comparison) sp.set("comparison", params.comparison);
      const res = await fetch(`/api/tenants/${tenantId}/reports/cash-flow?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch cash flow");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
