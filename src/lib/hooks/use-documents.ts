import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface DocumentsParams {
  status?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
}

export function useDocuments(params: DocumentsParams = {}) {
  const tenantId = getWorkspaceTenantId();
  const { status, page = 1, limit = 20, sort = "createdAt", order = "desc", search } = params;

  return useQuery({
    queryKey: ["documents", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ tenantId, page: String(page), limit: String(limit), sort, order });
      if (status) sp.set("status", status);
      if (search) sp.set("search", search);
      const res = await fetch(`/api/documents?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch documents");
      return json;
    },
    enabled: !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
  });
}

export function useDocument(id: string | null) {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["document", id, tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${id}?tenantId=${tenantId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!id && !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
  });
}

export function useDocumentMutations() {
  const queryClient = useQueryClient();
  const tenantId = getWorkspaceTenantId();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["document"] });
  };

  const submit = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async ({ docId, comment }: { docId: string; comment: string }) => {
      const res = await fetch(`/api/documents/${docId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, comment }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: invalidate,
  });

  const reOcr = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/re-ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: invalidate,
  });

  return { submit, approve, reject, reOcr };
}
