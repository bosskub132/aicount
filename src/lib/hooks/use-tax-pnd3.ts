import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface TaxPnd3Params {
  period: string;
}

export const taxPnd3Keys = {
  detail: (tenantId: string, params: TaxPnd3Params) =>
    ["tax-pnd3", tenantId, params] as const,
};

export function useTaxPnd3(params: TaxPnd3Params) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: taxPnd3Keys.detail(tenantId, params),
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period });
      const res = await fetch(`/api/tenants/${tenantId}/reports/tax/pnd3?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch PND3 report");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
