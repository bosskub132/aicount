import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface TaxPp36Params {
  period: string;
}

export function useTaxPp36(params: TaxPp36Params) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["tax-pp36", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period });
      const res = await fetch(`/api/tenants/${tenantId}/reports/tax/pp36?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch PP36 report");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
