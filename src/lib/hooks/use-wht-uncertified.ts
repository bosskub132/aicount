import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export function useWhtUncertified(params: { period: string }) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["wht-certificates", "uncertified", tenantId, params.period],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("period", params.period);
      const res = await fetch(
        `/api/tenants/${tenantId}/wht-certificates/uncertified?${sp.toString()}`
      );
      const json = await res.json();
      if (!json.success)
        throw new Error(
          json.error || "Failed to fetch uncertified WHT documents"
        );
      return json.data;
    },
    enabled: !!tenantId && !!params.period,
  });
}
