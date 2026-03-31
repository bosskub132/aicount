import type { LearnedRule, ExtractedData } from "../types";

const EXTRACTION_RULES = `
## Thai Accounting Document Parsing Rules

1. **Thai Dates (Buddhist Era):** Thai dates use Buddhist Era (BE) which is 543 years ahead of CE. Convert BE years to CE by subtracting 543. Example: 2569 BE = 2026 CE. Common formats: DD/MM/YYYY, DD-MM-YYYY, DD เดือน YYYY.

2. **Numbers:** Thai documents may use mixed comma/period formatting. Commas can be thousands separators OR decimal separators depending on context. If a number like "1,500.00" appears, the comma is a thousands separator and period is decimal. If "1.500,00" appears, the period is thousands and comma is decimal. Amounts near the total line are most reliable for determining format.

3. **Tax IDs:** Thai tax IDs are exactly 13 digits. Extract the full 13-digit number. Do not confuse with phone numbers (10 digits) or postal codes (5 digits).

4. **Invoice Numbers:** The invoice/document number is a specific reference code (e.g., "INV-2026-001", "RV66/0042"). Do NOT extract the word "INVOICE" or "ใบกำกับภาษี" as the invoice number. Look for fields labeled เลขที่, No., Invoice No., Document No.

5. **VAT:** Extract the actual VAT amount in currency (e.g., 700.00), NOT the percentage "7%". Thai standard VAT rate is 7%. If only the percentage is shown, calculate from the net amount.

6. **Currency:** Default to THB (Thai Baht) unless another currency is explicitly stated (USD, EUR, etc.).

7. **Discounts:** Extract both line-item discounts (per item) and invoice-level discounts (applied to subtotal) separately. net_amount_ex_vat should be AFTER all discounts but BEFORE VAT.

8. **Branches:** Branch information appears as "สาขา" or "Branch". "สำนักงานใหญ่" means Head Office (branch 00000). Extract the branch number if present.

9. **Document Types:** Classify as one of: invoice, receipt, tax_invoice, credit_note, debit_note, receipt_tax_invoice, purchase_order, quotation, delivery_note, other.
`.trim();

const OUTPUT_SCHEMA = `
## Required Output JSON Schema

Return a JSON object with this exact structure:
{
  "issuer": {
    "name": string | null,
    "tax_id": string | null,
    "branch_id": string | null,
    "address": string | null,
    "postal_code": string | null
  },
  "customer": {
    "name": string | null,
    "tax_id": string | null,
    "branch_id": string | null,
    "address": string | null,
    "postal_code": string | null
  },
  "document": {
    "document_type": string | null,
    "invoice_number": string | null,
    "issue_date": string | null,
    "due_date": string | null,
    "credit_days": number | null,
    "credit_due_date": string | null,
    "reference_po": string | null
  },
  "amounts": {
    "net_amount_ex_vat": number | null,
    "vat_amount": number | null,
    "total_amount": number | null,
    "discount_amount": number | null,
    "currency": string,
    "is_vat_included": boolean | null
  },
  "line_items": [
    {
      "description": string,
      "quantity": number | null,
      "unit_price": number | null,
      "discount": number | null,
      "total": number | null,
      "category": string | null
    }
  ],
  "confidence": {
    "overall": number (0-1),
    "per_field": {
      "issuer_name": number (0-1),
      "issuer_tax_id": number (0-1),
      "document_type": number (0-1),
      "invoice_number": number (0-1),
      "invoice_date": number (0-1),
      "total_amount": number (0-1),
      "net_amount_ex_vat": number (0-1),
      "vat_amount": number (0-1)
    }
  }
}
`.trim();

function formatLearnedRules(rules: LearnedRule[]): string {
  if (rules.length === 0) return "";

  const ruleLines = rules.map(
    (r) =>
      `- [${r.ruleType}] When "${r.triggerKey}" = "${r.triggerValue}": ${r.ruleText}` +
      (r.deterministicValue ? ` (use value: ${r.deterministicValue})` : "")
  );

  return `
## Learned Rules (from previous corrections)

Apply these rules when the matching conditions are met:
${ruleLines.join("\n")}
`;
}

/**
 * Build the base extraction prompt for Tier 1 (Haiku).
 */
export function buildBasePrompt(rawText: string, rules: LearnedRule[]): string {
  const learnedSection = formatLearnedRules(rules);

  return `You are a Thai accounting document parser. Extract structured data from the following OCR text of a Thai accounting document.

${EXTRACTION_RULES}

${OUTPUT_SCHEMA}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation text. Just the JSON object.
${learnedSection}
## OCR Text

${rawText}`;
}

/**
 * Build the Tier 2 prompt that includes the Tier 1 result and escalation reasons.
 */
export function buildTier2Prompt(
  rawText: string,
  rules: LearnedRule[],
  tier1Result: ExtractedData,
  escalationReasons: string[]
): string {
  const learnedSection = formatLearnedRules(rules);

  return `You are a Thai accounting document parser. A previous extraction attempt had issues that need correction. Re-extract the data with careful attention to the flagged problems.

${EXTRACTION_RULES}

${OUTPUT_SCHEMA}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation text. Just the JSON object.
${learnedSection}
## Previous Extraction Attempt (Tier 1)

${JSON.stringify(tier1Result, null, 2)}

## Issues Found

The following problems were detected in the previous extraction:
${escalationReasons.map((r) => `- ${r}`).join("\n")}

Please re-extract the document data with special attention to the issues listed above.

## OCR Text

${rawText}`;
}

/**
 * Build the Tier 3 prompt for vision-based extraction with cross-checking.
 */
export function buildTier3Prompt(
  rawText: string,
  rules: LearnedRule[],
  tier1Result: ExtractedData,
  tier2Result: ExtractedData,
  escalationReasons: string[]
): string {
  const learnedSection = formatLearnedRules(rules);

  return `You are a Thai accounting document parser. Extract structured data from this document IMAGE. Cross-check what you see in the image with the Google Vision raw text provided below.

${EXTRACTION_RULES}

${OUTPUT_SCHEMA}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation text. Just the JSON object.
${learnedSection}
## Google Vision Raw Text (for cross-reference)

${rawText}

## Prior Extraction Attempts

### Tier 1 Result
${JSON.stringify(tier1Result, null, 2)}

### Tier 2 Result
${JSON.stringify(tier2Result, null, 2)}

## Issues Found

The following problems persisted across both extraction attempts:
${escalationReasons.map((r) => `- ${r}`).join("\n")}

Use the document image as the primary source. Cross-check amounts and fields against the raw text above. Resolve any discrepancies by trusting what you see in the image.`;
}
