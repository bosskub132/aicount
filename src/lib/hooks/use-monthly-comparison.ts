import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface MonthlyComparisonParams {
  year: number;
  department?: string;
}

export function useMonthlyComparison(params: MonthlyComparisonParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["monthly-comparison", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ year: String(params.year) });
      if (params.department) sp.set("department", params.department);
      const res = await fetch(`/api/tenants/${tenantId}/reports/monthly-comparison?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch monthly comparison");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
