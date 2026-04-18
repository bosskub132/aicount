import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/stores/ui-store";

interface JournalEntriesFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
}

export const journalEntriesKeys = {
  list: (tenantId: string, filters: JournalEntriesFilters) =>
    ["journal-entries", tenantId, filters] as const,
  detail: (tenantId: string, entryId: string | null) =>
    ["journal-entry", tenantId, entryId] as const,
};

export function useJournalEntries(tenantId: string, filters: JournalEntriesFilters = {}) {
  const { status, dateFrom, dateTo, page = 1, limit = 20, sort = "createdAt", order = "desc", search } = filters;

  return useQuery({
    queryKey: journalEntriesKeys.list(tenantId, filters),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(page), limit: String(limit), sort, order });
      if (status) sp.set("status", status);
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);
      if (search) sp.set("search", search);
      const res = await fetch(`/api/tenants/${tenantId}/journal-entries?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch journal entries");
      return json;
    },
    enabled: !!tenantId,
  });
}

export function useJournalEntry(tenantId: string, entryId: string | null) {
  return useQuery({
    queryKey: ["journal-entry", tenantId, entryId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/journal-entries/${entryId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch journal entry");
      return json.data;
    },
    enabled: !!tenantId && !!entryId,
  });
}

interface CreateJournalEntryInput {
  date: string;
  description: string;
  lines: Array<{
    accountCode: string;
    debit?: number;
    credit?: number;
    description?: string;
  }>;
  documentId?: string;
}

export function useCreateJournalEntry(tenantId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: CreateJournalEntryInput) => {
      const res = await fetch(`/api/tenants/${tenantId}/journal-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to create journal entry");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries", tenantId] });
      toast.success("Journal entry created successfully");
    },
    onError: () => {
      toast.error("Failed to create journal entry");
    },
  });
}

interface UpdateJournalEntryInput {
  entryId: string;
  date?: string;
  description?: string;
  lines?: Array<{
    accountCode: string;
    debit?: number;
    credit?: number;
    description?: string;
  }>;
}

export function useUpdateJournalEntry(tenantId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ entryId, ...data }: UpdateJournalEntryInput) => {
      const res = await fetch(`/api/tenants/${tenantId}/journal-entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update journal entry");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["journal-entry", tenantId] });
      toast.success("Journal entry updated successfully");
    },
    onError: () => {
      toast.error("Failed to update journal entry");
    },
  });
}

export function usePostJournalEntry(tenantId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/journal-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to post journal entry");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["journal-entry", tenantId] });
      toast.success("Journal entry posted successfully");
    },
    onError: () => {
      toast.error("Failed to post journal entry");
    },
  });
}

export function useReverseJournalEntry(tenantId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/journal-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reverse" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to reverse journal entry");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["journal-entry", tenantId] });
      toast.success("Journal entry reversed successfully");
    },
    onError: () => {
      toast.error("Failed to reverse journal entry");
    },
  });
}
