import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface JournalListingParams {
  period: string;
  scope: string;
  type?: string;
  page?: number;
  limit?: number;
}

export function useJournalListing(params: JournalListingParams) {
  const tenantId = getWorkspaceTenantId();

  return useQuery({
    queryKey: ["journal-listing", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ period: params.period, scope: params.scope });
      if (params.type) sp.set("type", params.type);
      if (params.page !== undefined) sp.set("page", String(params.page));
      if (params.limit !== undefined) sp.set("limit", String(params.limit));
      const res = await fetch(`/api/tenants/${tenantId}/reports/journal-listing?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch journal listing");
      return json.data;
    },
    enabled: !!tenantId,
  });
}
