import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface TaxPp30Params {
  period: string;
}

export function useTaxPp30(params: TaxPp30Params) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["tax-pp30", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period });
      const res = await fetch(`/api/tenants/${tenantId}/reports/tax/pp30?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch PP30 report");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
