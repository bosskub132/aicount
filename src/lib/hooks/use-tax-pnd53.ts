import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId, isDefaultWorkspaceTenantId } from "@/components/workspace-selector";

interface TaxPnd53Params {
  period: string;
}

export function useTaxPnd53(params: TaxPnd53Params) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["tax-pnd53", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period });
      const res = await fetch(`/api/tenants/${tenantId}/reports/tax/pnd53?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch PND53 report");
      return json.data;
    },
    enabled: !!tenantId && !isDefaultWorkspaceTenantId(tenantId),
  });
}
