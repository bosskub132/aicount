import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceTenantId, isDefaultWorkspaceTenantId } from "@/components/workspace-selector";
import { useToast } from "@/lib/stores/ui-store";

export function useReportRetention() {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["report-retention", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/settings/report-retention`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch retention policy");
      return json.data;
    },
    enabled: !!tenantId && !isDefaultWorkspaceTenantId(tenantId),
  });
}

export function useUpdateRetentionPolicy() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (policy: Record<string, unknown>) => {
      const res = await fetch(`/api/tenants/${tenantId}/settings/report-retention`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update retention policy");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-retention"] });
      toast.success("Retention policy updated successfully");
    },
    onError: () => {
      toast.error("Failed to update retention policy");
    },
  });
}
