import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId, isDefaultWorkspaceTenantId } from "@/components/workspace-selector";

interface BalanceSheetParams {
  period: string;
  scope: string;
  comparison?: string;
}

export function useBalanceSheet(params: BalanceSheetParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["balance-sheet", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period, scope: params.scope });
      if (params.comparison) sp.set("comparison", params.comparison);
      const res = await fetch(`/api/tenants/${tenantId}/reports/balance-sheet?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch balance sheet");
      return json.data;
    },
    enabled: !!tenantId && !isDefaultWorkspaceTenantId(tenantId),
  });
}
