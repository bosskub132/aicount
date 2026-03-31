import type { ExtractedData, ValidationResult } from "../types";

const WEIGHTED_CONFIDENCE_THRESHOLD = 0.70;
const CRITICAL_FIELD_THRESHOLD = 0.50;

const CRITICAL_FIELDS = [
  "issuer_tax_id",
  "total_amount",
  "vat_amount",
  "invoice_number",
  "issue_date",
] as const;

function collectReasons(
  data: ExtractedData,
  validation: ValidationResult
): string[] {
  const reasons: string[] = [];

  // Condition A: weighted confidence too low
  if (data.confidence.weighted < WEIGHTED_CONFIDENCE_THRESHOLD) {
    reasons.push(`weighted_confidence_${data.confidence.weighted}`);
  }

  // Condition B: any critical field below threshold
  for (const field of CRITICAL_FIELDS) {
    const fieldConfidence = data.confidence.per_field[field];
    if (fieldConfidence !== undefined && fieldConfidence < CRITICAL_FIELD_THRESHOLD) {
      reasons.push(`low_field:${field}=${fieldConfidence}`);
    }
  }

  // Condition C: any amount validation level fails
  if (!validation.lineItemCheck.isValid) {
    reasons.push("line_item_check_failed");
  }
  if (!validation.subtotalCheck.isValid) {
    reasons.push("subtotal_check_failed");
  }
  if (!validation.vatCheck.isValid) {
    reasons.push("vat_check_failed");
  }
  if (!validation.grandTotalCheck.isValid) {
    reasons.push("grand_total_check_failed");
  }

  return reasons;
}

export function shouldEscalate(
  data: ExtractedData,
  validation: ValidationResult,
  withReasons?: true
): { escalate: boolean; reasons: string[] };
export function shouldEscalate(
  data: ExtractedData,
  validation: ValidationResult,
  withReasons?: false
): boolean;
export function shouldEscalate(
  data: ExtractedData,
  validation: ValidationResult,
  withReasons?: boolean
): boolean | { escalate: boolean; reasons: string[] } {
  const reasons = collectReasons(data, validation);
  const escalate = reasons.length > 0;

  if (withReasons) {
    return { escalate, reasons };
  }

  return escalate;
}
