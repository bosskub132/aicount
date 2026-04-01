import * as coaSuggester from "./providers/coa-suggester";
import * as whtSuggester from "./providers/wht-suggester";
import * as duplicateChecker from "./providers/duplicate-checker";
import * as defaultsSuggester from "./providers/defaults-suggester";
import {
  insertSuggestions,
  getPendingSuggestions,
  hasAnySuggestions,
} from "@/lib/db/queries/suggestions";
import { getPendingDuplicates } from "@/lib/db/queries/duplicates";
import type { Suggestion, SuggestionResult, DuplicateCandidate } from "./types";

type Mode = "eager" | "lazy";

export async function getSuggestions(
  documentId: string,
  tenantId: string,
  mode: Mode
): Promise<SuggestionResult[]> {
  const providers =
    mode === "eager"
      ? [
          () => coaSuggester.fromHistory(documentId, tenantId),
          () => whtSuggester.fromHistory(documentId, tenantId),
          () => defaultsSuggester.fromHistory(documentId, tenantId),
        ]
      : [
          () => coaSuggester.full(documentId, tenantId),
          () => whtSuggester.fromVendorType(documentId, tenantId),
          () => duplicateChecker.contentMatch(documentId, tenantId),
        ];

  const settled = await Promise.allSettled(providers.map((p) => p()));

  const allResults: SuggestionResult[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    }
  }

  // Deduplicate by fieldName — keep highest confidence
  const byField = new Map<string, SuggestionResult>();
  for (const r of allResults) {
    const existing = byField.get(r.fieldName);
    if (!existing || r.confidence > existing.confidence) {
      byField.set(r.fieldName, r);
    }
  }

  const deduplicated = Array.from(byField.values());

  if (deduplicated.length > 0) {
    await insertSuggestions(tenantId, documentId, deduplicated);
  }

  return deduplicated;
}

export async function fetchAllForDocument(
  documentId: string,
  tenantId: string
): Promise<{ suggestions: Suggestion[]; duplicates: DuplicateCandidate[] }> {
  const alreadyHasSuggestions = await hasAnySuggestions(documentId, tenantId);
  if (!alreadyHasSuggestions) {
    await getSuggestions(documentId, tenantId, "lazy");
  }

  const [suggestions, duplicates] = await Promise.all([
    getPendingSuggestions(documentId),
    getPendingDuplicates(documentId),
  ]);

  return { suggestions, duplicates };
}
