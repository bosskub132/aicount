"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import type {
  Suggestion,
  DuplicateCandidate,
  SuggestionOutcome,
  DuplicateOutcome,
} from "@/lib/services/suggestions/types";

const isValidTenant = (id: string) =>
  !!id && id !== "00000000-0000-0000-0000-000000000000";

export function useSuggestions(documentId: string | undefined) {
  const tenantId = getWorkspaceTenantId();

  const [outcomes, setOutcomes] = useState<Map<string, SuggestionOutcome>>(
    new Map()
  );
  const [duplicateOutcomes, setDuplicateOutcomes] = useState<
    Map<string, DuplicateOutcome>
  >(new Map());

  const query = useQuery({
    queryKey: ["suggestions", documentId, tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/suggestions`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as {
        suggestions: Suggestion[];
        duplicates: DuplicateCandidate[];
      };
    },
    enabled: isValidTenant(tenantId) && !!documentId,
  });

  const pendingSuggestions = (query.data?.suggestions ?? []).filter(
    (s) => !outcomes.has(s.id)
  );

  const pendingDuplicates = (query.data?.duplicates ?? []).filter(
    (d) => !duplicateOutcomes.has(d.id)
  );

  const acceptSuggestion = useCallback((id: string) => {
    setOutcomes((prev) => {
      const next = new Map(prev);
      next.set(id, { id, status: "accepted" });
      return next;
    });
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setOutcomes((prev) => {
      const next = new Map(prev);
      next.set(id, { id, status: "dismissed" });
      return next;
    });
  }, []);

  const editSuggestion = useCallback((id: string, finalValue: string) => {
    setOutcomes((prev) => {
      const next = new Map(prev);
      next.set(id, { id, status: "edited", finalValue });
      return next;
    });
  }, []);

  const acceptAll = useCallback(() => {
    const allSuggestions = query.data?.suggestions ?? [];
    setOutcomes((prev) => {
      const next = new Map(prev);
      for (const s of allSuggestions) {
        if (!next.has(s.id)) {
          next.set(s.id, { id: s.id, status: "accepted" });
        }
      }
      return next;
    });
  }, [query.data?.suggestions]);

  const clearAll = useCallback(() => {
    const allSuggestions = query.data?.suggestions ?? [];
    setOutcomes((prev) => {
      const next = new Map(prev);
      for (const s of allSuggestions) {
        if (!next.has(s.id)) {
          next.set(s.id, { id: s.id, status: "dismissed" });
        }
      }
      return next;
    });
  }, [query.data?.suggestions]);

  const dismissDuplicate = useCallback((id: string) => {
    setDuplicateOutcomes((prev) => {
      const next = new Map(prev);
      next.set(id, { id, status: "dismissed" });
      return next;
    });
  }, []);

  const getBatchOutcomes = useCallback(() => {
    return {
      suggestionOutcomes: Array.from(outcomes.values()),
      duplicateOutcomes: Array.from(duplicateOutcomes.values()),
    };
  }, [outcomes, duplicateOutcomes]);

  return {
    suggestions: pendingSuggestions,
    duplicates: pendingDuplicates,
    allSuggestions: query.data?.suggestions ?? [],
    isLoading: query.isLoading,
    acceptSuggestion,
    dismissSuggestion,
    editSuggestion,
    acceptAll,
    clearAll,
    dismissDuplicate,
    getBatchOutcomes,
  };
}
