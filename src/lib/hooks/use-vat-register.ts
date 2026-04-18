import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface VatRegisterParams {
  period: string;
  direction: "EXPENSE" | "REVENUE";
}

export function useVatRegister(params: VatRegisterParams) {
  const tenantId = getWorkspaceTenantId();
  const endpoint = params.direction === "EXPENSE" ? "purchase-vat" : "sales-vat";

  return useQuery({
    queryKey: ["vat-register", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period });
      const res = await fetch(`/api/tenants/${tenantId}/reports/tax/${endpoint}?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch VAT register");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
