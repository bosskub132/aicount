import { resolveSuggestions } from "@/lib/db/queries/suggestions";
import { resolveDuplicates } from "@/lib/db/queries/duplicates";
import { feedLearner } from "./learner";
import type { SuggestionOutcome, DuplicateOutcome } from "./types";

export async function processBatchOutcomes(
  suggestionOutcomes: SuggestionOutcome[],
  duplicateOutcomes: DuplicateOutcome[]
): Promise<void> {
  if (suggestionOutcomes.length > 0) {
    await resolveSuggestions(suggestionOutcomes);
    feedLearner(suggestionOutcomes).catch(() => {});
  }

  if (duplicateOutcomes.length > 0) {
    await resolveDuplicates(duplicateOutcomes);
  }
}
