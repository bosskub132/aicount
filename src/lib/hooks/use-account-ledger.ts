import { useQuery } from "@tanstack/react-query";

export function useAccountLedger(
  tenantId: string,
  accountCode: string | null,
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: ["account-ledger", tenantId, accountCode, dateFrom, dateTo],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (accountCode) sp.set("accountCode", accountCode);
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);
      const res = await fetch(`/api/tenants/${tenantId}/account-ledger?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch account ledger");
      return json.data;
    },
    enabled: !!tenantId && !!accountCode,
  });
}
