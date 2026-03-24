import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId, isDefaultWorkspaceTenantId } from "@/components/workspace-selector";

interface TaxPnd3Params {
  period: string;
}

export function useTaxPnd3(params: TaxPnd3Params) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["tax-pnd3", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period });
      const res = await fetch(`/api/tenants/${tenantId}/reports/tax/pnd3?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch PND3 report");
      return json.data;
    },
    enabled: !!tenantId && !isDefaultWorkspaceTenantId(tenantId),
  });
}
