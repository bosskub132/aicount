import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface TrialBalanceParams {
  period: string;
  scope: string;
  department?: string;
}

export function useTrialBalance(params: TrialBalanceParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["trial-balance", tenantId, params],
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
