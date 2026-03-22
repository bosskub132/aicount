import { useQuery } from "@tanstack/react-query";

interface PayablesFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export function usePayables(tenantId: string, filters: PayablesFilters = {}) {
  const { status, dateFrom, dateTo, page = 1, limit = 20, search } = filters;

  return useQuery({
    queryKey: ["payables", tenantId, filters],
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) sp.set("status", status);
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);
      if (search) sp.set("search", search);
      const res = await fetch(`/api/tenants/${tenantId}/payables?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch payables");
      return json;
    },
    enabled: !!tenantId,
  });
}
