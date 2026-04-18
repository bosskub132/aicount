import { useQuery } from "@tanstack/react-query";

export const bankStatementsKeys = {
  list: (tenantId: string) => ["bank-statements", tenantId] as const,
};

/**
 * Fetch all bank statements for a tenant (for the statement selector).
 */
export function useBankStatements(tenantId: string) {
  return useQuery({
    queryKey: bankStatementsKeys.list(tenantId),
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/bank-statements`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch bank statements");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
