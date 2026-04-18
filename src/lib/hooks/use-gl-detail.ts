import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface GlDetailParams {
  period: string;
  scope: string;
  account: string;
  page?: number;
  limit?: number;
}

export function useGlDetail(params: GlDetailParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["gl-detail", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({
        period: params.period,
        scope: params.scope,
        account: params.account,
      });
      if (params.page !== undefined) sp.set("page", String(params.page));
      if (params.limit !== undefined) sp.set("limit", String(params.limit));
      const res = await fetch(`/api/tenants/${tenantId}/reports/gl-detail?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch GL detail");
      return json.data;
    },
    enabled: !!tenantId && !!params.account,
  });
}
