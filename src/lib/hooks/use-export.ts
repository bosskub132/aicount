import { useQuery, useMutation } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export function useExportTemplates() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["export-templates", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/export/templates?tenantId=${tenantId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
  });
}

export function useExportHistory() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["export-history", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/export-history`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
  });
}

export function useExportMutation() {
  return useMutation({
    mutationFn: async (payload: {
      tenantId: string;
      templateId: string;
      selectedDocumentIds: string[];
      exportMode: string;
      period?: string;
      journalType?: string;
    }) => {
      const res = await fetch("/api/export/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, returnContent: false }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });
}
