import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export const dashboardKeys = {
  monthlyComparison: (tenantId: string, months: number) =>
    ["monthly-comparison", tenantId, months] as const,
  statusBreakdown: (tenantId: string) =>
    ["status-breakdown", tenantId] as const,
  approvalQueue: (tenantId: string) =>
    ["approval-queue", tenantId] as const,
};

export function useMonthlyComparison(months = 6) {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: dashboardKeys.monthlyComparison(tenantId, months),
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/monthly-comparison?months=${months}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useStatusBreakdown() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: dashboardKeys.statusBreakdown(tenantId),
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/status-breakdown`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useApprovalQueue() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: dashboardKeys.approvalQueue(tenantId),
    queryFn: async () => {
      const res = await fetch(`/api/documents/approval-queue`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}
