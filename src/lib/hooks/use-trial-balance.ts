import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface TrialBalanceParams {
  period: string;
  scope: string;
  department?: string;
}

export const trialBalanceKeys = {
  detail: (tenantId: string, params: TrialBalanceParams) =>
    ["trial-balance", tenantId, params] as const,
};

export function useTrialBalance(params: TrialBalanceParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: trialBalanceKeys.detail(tenantId, params),
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period, scope: params.scope });
      if (params.department) sp.set("department", params.department);
      const res = await fetch(`/api/tenants/${tenantId}/reports/trial-balance?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch trial balance");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
