import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaceTenantId,
  isDefaultWorkspaceTenantId,
} from "@/components/workspace-selector";
import { useToast } from "@/lib/stores/ui-store";

interface WhtCertificateListParams {
  period?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function useWhtCertificates(params: WhtCertificateListParams = {}) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["wht-certificates", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params.period) sp.set("period", params.period);
      if (params.search) sp.set("search", params.search);
      if (params.status) sp.set("status", params.status);
      if (params.page !== undefined) sp.set("page", String(params.page));
      if (params.limit !== undefined) sp.set("limit", String(params.limit));
      const query = sp.toString();
      const res = await fetch(
        `/api/tenants/${tenantId}/wht-certificates${query ? `?${query}` : ""}`
      );
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error || "Failed to fetch WHT certificates");
      return json.data;
    },
    enabled: !!tenantId && !isDefaultWorkspaceTenantId(tenantId),
  });
}

export function useWhtCertificateStats(params: { period: string }) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["wht-certificates", "stats", tenantId, params.period],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("period", params.period);
      sp.set("statsOnly", "true");
      const res = await fetch(
        `/api/tenants/${tenantId}/wht-certificates?${sp.toString()}`
      );
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error || "Failed to fetch WHT certificate stats");
      return json.data.stats;
    },
    enabled:
      !!tenantId && !isDefaultWorkspaceTenantId(tenantId) && !!params.period,
  });
}

export function useGenerateWhtCertificate() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: { documentId: string }) => {
      const res = await fetch(
        `/api/tenants/${tenantId}/wht-certificates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error || "Failed to generate WHT certificate");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wht-certificates"] });
      toast.success("WHT certificate generated successfully");
    },
    onError: () => {
      toast.error("Failed to generate WHT certificate");
    },
  });
}

export function useVoidWhtCertificate() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      certId,
      reason,
    }: {
      certId: string;
      reason: string;
    }) => {
      const res = await fetch(
        `/api/tenants/${tenantId}/wht-certificates/${certId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "void", reason }),
        }
      );
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error || "Failed to void WHT certificate");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wht-certificates"] });
      toast.success("WHT certificate voided successfully");
    },
    onError: () => {
      toast.error("Failed to void WHT certificate");
    },
  });
}

export function useBatchGenerateWht() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: { documentIds: string[] }) => {
      const res = await fetch(
        `/api/tenants/${tenantId}/wht-certificates/batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await res.json();
      if (!json.success)
        throw new Error(
          json.error || "Failed to start batch WHT certificate generation"
        );
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wht-certificates"] });
      toast.success("Batch WHT certificate generation started");
    },
    onError: () => {
      toast.error("Failed to start batch WHT certificate generation");
    },
  });
}
