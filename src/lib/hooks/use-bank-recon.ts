import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/stores/ui-store";

export function useBankRecon(tenantId: string, bankStatementId: string | null) {
  return useQuery({
    queryKey: ["bank-recon", tenantId, bankStatementId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (bankStatementId) sp.set("bankStatementId", bankStatementId);
      const res = await fetch(`/api/tenants/${tenantId}/bank-recon?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch bank reconciliation data");
      return json.data;
    },
    enabled: !!tenantId && !!bankStatementId,
  });
}

export function useConfirmMatch(tenantId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: {
      bankTransactionId: string;
      journalEntryId: string;
      matchType: "auto" | "manual";
    }) => {
      const res = await fetch(`/api/tenants/${tenantId}/bank-recon/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to confirm match");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-recon", tenantId] });
      toast.success("Match confirmed");
    },
    onError: () => {
      toast.error("Failed to confirm match");
    },
  });
}

export function useDeleteMatch(tenantId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/bank-recon/matches`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete match");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-recon", tenantId] });
      toast.success("Match removed");
    },
    onError: () => {
      toast.error("Failed to remove match");
    },
  });
}

export function useBulkConfirm(tenantId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (matches: Array<{
      bankTransactionId: string;
      journalEntryId: string;
      matchType: "auto" | "manual";
    }>) => {
      // Confirm matches sequentially to avoid conflicts
      const results = [];
      for (const match of matches) {
        const res = await fetch(`/api/tenants/${tenantId}/bank-recon/matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(match),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to confirm match");
        results.push(json.data);
      }
      return results;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bank-recon", tenantId] });
      toast.success(`${variables.length} matches confirmed`);
    },
    onError: () => {
      toast.error("Failed to confirm matches");
    },
  });
}
