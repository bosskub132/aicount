import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

const isValidTenant = (id: string) => !!id && id !== "00000000-0000-0000-0000-000000000000";

export function useMonthlyComparison(months = 6) {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["monthly-comparison", tenantId, months],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/monthly-comparison?months=${months}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: isValidTenant(tenantId),
  });
}

export function useStatusBreakdown() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["status-breakdown", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/status-breakdown`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: isValidTenant(tenantId),
  });
}

export function useApprovalQueue() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["approval-queue", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/approval-queue`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: isValidTenant(tenantId),
  });
}
