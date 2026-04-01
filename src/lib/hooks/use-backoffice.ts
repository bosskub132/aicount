import { useQuery } from "@tanstack/react-query";

export function useBackofficeAnalytics(year: number, month: number) {
  return useQuery({
    queryKey: ["backoffice-analytics", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/backoffice/analytics?year=${year}&month=${month}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });
}

export function useBackofficeTenantUsage(year: number, month: number, search: string, page: number) {
  return useQuery({
    queryKey: ["backoffice-tenant-usage", year, month, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year), month: String(month), page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/backoffice/analytics/tenants?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return { data: json.data, meta: json.meta };
    },
  });
}

export function useBackofficeRules(filters: { tenantId?: string; status?: string; type?: string; search?: string; page: number }) {
  return useQuery({
    queryKey: ["backoffice-rules", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(filters.page), limit: "20" });
      if (filters.tenantId) params.set("tenantId", filters.tenantId);
      if (filters.status) params.set("status", filters.status);
      if (filters.type) params.set("type", filters.type);
      if (filters.search) params.set("search", filters.search);
      const res = await fetch(`/api/backoffice/rules?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return { data: json.data, meta: json.meta, stats: json.stats };
    },
  });
}

export function useBackofficeTenants() {
  return useQuery({
    queryKey: ["backoffice-tenants"],
    queryFn: async () => {
      const res = await fetch("/api/backoffice/tenants");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });
}
