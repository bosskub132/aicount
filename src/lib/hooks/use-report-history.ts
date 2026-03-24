import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceTenantId, isDefaultWorkspaceTenantId } from "@/components/workspace-selector";
import { useToast } from "@/lib/stores/ui-store";

interface ReportHistoryParams {
  reportType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function useReportHistory(params: ReportHistoryParams = {}) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["report-history", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params.reportType) sp.set("reportType", params.reportType);
      if (params.status) sp.set("status", params.status);
      if (params.page !== undefined) sp.set("page", String(params.page));
      if (params.limit !== undefined) sp.set("limit", String(params.limit));
      const query = sp.toString();
      const res = await fetch(`/api/tenants/${tenantId}/reports/history${query ? `?${query}` : ""}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch report history");
      return json.data;
    },
    enabled: !!tenantId && !isDefaultWorkspaceTenantId(tenantId),
  });
}

export function useLockReport() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/history/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to lock report");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-history"] });
      toast.success("Report locked successfully");
    },
    onError: () => {
      toast.error("Failed to lock report");
    },
  });
}

export function useUnlockReport() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/history/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to unlock report");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-history"] });
      toast.success("Report unlocked successfully");
    },
    onError: () => {
      toast.error("Failed to unlock report");
    },
  });
}

export function useDeleteReport() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/history/${reportId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete report");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-history"] });
      toast.success("Report deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete report");
    },
  });
}

export function useRestoreReport() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/history/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to restore report");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-history"] });
      toast.success("Report restored successfully");
    },
    onError: () => {
      toast.error("Failed to restore report");
    },
  });
}
