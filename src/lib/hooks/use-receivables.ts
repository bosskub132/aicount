import { useQuery } from "@tanstack/react-query";

interface ReceivablesFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export const receivablesKeys = {
  list: (tenantId: string, filters: ReceivablesFilters) =>
    ["receivables", tenantId, filters] as const,
};

export function useReceivables(tenantId: string, filters: ReceivablesFilters = {}) {
  const { status, dateFrom, dateTo, page = 1, limit = 20, search } = filters;

  return useQuery({
    queryKey: receivablesKeys.list(tenantId, filters),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) sp.set("status", status);
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);
      if (search) sp.set("search", search);
      const res = await fetch(`/api/tenants/${tenantId}/receivables?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch receivables");
      return json;
    },
    enabled: !!tenantId,
  });
}
