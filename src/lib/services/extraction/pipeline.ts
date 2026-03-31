import { extractTier1 } from "./tiers/tier1-haiku";
import { extractTier2 } from "./tiers/tier2-sonnet";
import { extractTier3 } from "./tiers/tier3-vision";
import { loadRules } from "./rules/rule-loader";
import { applyGraduatedRules } from "./rules/graduated-rules";
import { shouldEscalate } from "./validators/escalation-check";
import { validateAmounts } from "./validators/amount-validator";
import type {
  ExtractionResult,
  TierResult,
  ExtractedData,
  ValidationResult,
} from "./types";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Tier timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

function createEmptyTierResult(tier: 1 | 2 | 3): TierResult {
  const emptyData: ExtractedData = {
    issuer: {
      name: null,
      tax_id: null,
      branch_id: null,
      address: null,
      postal_code: null,
    },
    customer: {
      name: null,
      tax_id: null,
      branch_id: null,
      address: null,
      postal_code: null,
    },
    document: {
      document_type: null,
      invoice_number: null,
      issue_date: null,
      due_date: null,
      credit_days: null,
      credit_due_date: null,
      reference_po: null,
    },
    amounts: {
      net_amount_ex_vat: null,
      vat_amount: null,
      total_amount: null,
      discount_amount: null,
      currency: "THB",
      is_vat_included: null,
    },
    line_items: [],
    confidence: { overall: 0, weighted: 0, per_field: {} },
  };

  const emptyValidation: ValidationResult = {
    lineItemCheck: { isValid: true, failures: [] },
    subtotalCheck: { isValid: true, expected: null, got: null },
    vatCheck: { isValid: true, expected: null, got: null },
    grandTotalCheck: { isValid: true, expected: null, got: null },
    overallValid: true,
  };

  return {
    tier,
    data: emptyData,
    validation: emptyValidation,
    escalationReasons: [],
    costUsd: 0,
  };
}

const TIER_TIMEOUT_MS = 30_000;

export async function extractDocument(
  rawText: string,
  tenantId: string,
  imageBase64?: string,
  mimeType?: string
): Promise<ExtractionResult> {
  const { promptRules, graduated } = await loadRules(tenantId, rawText);

  const allTierResults: TierResult[] = [];
  let bestResult: TierResult = createEmptyTierResult(1);

  // --- Tier 1 (Haiku) ---
  try {
    const tier1Raw = await withTimeout(
      extractTier1(rawText, promptRules),
      TIER_TIMEOUT_MS
    );

    const tier1Data = applyGraduatedRules(tier1Raw.data, graduated);
    const tier1Validation = validateAmounts(
      tier1Data.amounts,
      tier1Data.line_items
    );

    const { escalate, reasons } = shouldEscalate(
      tier1Data,
      tier1Validation,
      true
    );

    const tier1Result: TierResult = {
      ...tier1Raw,
      data: tier1Data,
      validation: tier1Validation,
      escalationReasons: reasons,
    };

    allTierResults.push(tier1Result);
    bestResult = tier1Result;

    if (!escalate) {
      return buildResult(bestResult, allTierResults);
    }

    // --- Tier 2 (Sonnet) ---
    try {
      const tier2Raw = await withTimeout(
        extractTier2(rawText, promptRules, tier1Data, reasons),
        TIER_TIMEOUT_MS
      );

      const tier2Data = applyGraduatedRules(tier2Raw.data, graduated);
      const tier2Validation = validateAmounts(
        tier2Data.amounts,
        tier2Data.line_items
      );

      const tier2Escalation = shouldEscalate(tier2Data, tier2Validation, true);

      const tier2Result: TierResult = {
        ...tier2Raw,
        data: tier2Data,
        validation: tier2Validation,
        escalationReasons: tier2Escalation.reasons,
      };

      allTierResults.push(tier2Result);
      bestResult = tier2Result;

      if (!tier2Escalation.escalate) {
        return buildResult(bestResult, allTierResults);
      }

      // --- Tier 3 (Vision) ---
      if (imageBase64 && mimeType) {
        try {
          const tier3Raw = await withTimeout(
            extractTier3(
              imageBase64,
              mimeType,
              rawText,
              promptRules,
              tier1Data,
              tier2Data,
              tier2Escalation.reasons
            ),
            TIER_TIMEOUT_MS
          );

          const tier3Data = applyGraduatedRules(tier3Raw.data, graduated);
          const tier3Validation = validateAmounts(
            tier3Data.amounts,
            tier3Data.line_items
          );

          const tier3Result: TierResult = {
            ...tier3Raw,
            data: tier3Data,
            validation: tier3Validation,
            escalationReasons: shouldEscalate(
              tier3Data,
              tier3Validation,
              true
            ).reasons,
          };

          allTierResults.push(tier3Result);
          bestResult = tier3Result;
        } catch (error: unknown) {
          // eslint-disable-next-line no-console
          console.error(
            "[extraction-pipeline] Tier 3 failed:",
            error instanceof Error ? error.message : error
          );
        }
      }
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(
        "[extraction-pipeline] Tier 2 failed:",
        error instanceof Error ? error.message : error
      );

      // If Tier 2 fails and we have an image, try Tier 3 directly
      if (imageBase64 && mimeType) {
        try {
          const tier3Raw = await withTimeout(
            extractTier3(
              imageBase64,
              mimeType,
              rawText,
              promptRules,
              tier1Raw.data,
              tier1Raw.data, // use tier1 data as tier2 fallback
              reasons
            ),
            TIER_TIMEOUT_MS
          );

          const tier3Data = applyGraduatedRules(tier3Raw.data, graduated);
          const tier3Validation = validateAmounts(
            tier3Data.amounts,
            tier3Data.line_items
          );

          const tier3Result: TierResult = {
            ...tier3Raw,
            data: tier3Data,
            validation: tier3Validation,
            escalationReasons: shouldEscalate(
              tier3Data,
              tier3Validation,
              true
            ).reasons,
          };

          allTierResults.push(tier3Result);
          bestResult = tier3Result;
        } catch (tier3Error: unknown) {
          // eslint-disable-next-line no-console
          console.error(
            "[extraction-pipeline] Tier 3 fallback failed:",
            tier3Error instanceof Error ? tier3Error.message : tier3Error
          );
        }
      }
    }
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error(
      "[extraction-pipeline] Tier 1 failed:",
      error instanceof Error ? error.message : error
    );
    // Return empty result if even Tier 1 fails
    allTierResults.push(bestResult);
  }

  return buildResult(bestResult, allTierResults);
}

function buildResult(
  best: TierResult,
  allTierResults: TierResult[]
): ExtractionResult {
  const totalCostUsd = allTierResults.reduce((sum, r) => sum + r.costUsd, 0);

  return {
    data: best.data,
    tierUsed: best.tier,
    allTierResults,
    validation: best.validation,
    escalationReasons: best.escalationReasons,
    totalCostUsd,
  };
}
