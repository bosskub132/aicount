import type { ExtractedData, LearnedRule } from "../types";
import { upsertExtractionRule } from "@/lib/db/queries/extraction-rules";

export interface Correction {
  fieldName: string;
  originalValue: string;
  correctedValue: string;
  triggerKey: string;
  triggerValue: string;
}

const FIELD_MAP: Record<string, { section: string; field: string }> = {
  issuerName: { section: "issuer", field: "name" },
  issuerTaxId: { section: "issuer", field: "tax_id" },
  issuerBranch: { section: "issuer", field: "branch_id" },
  documentNumber: { section: "document", field: "invoice_number" },
  documentDate: { section: "document", field: "issue_date" },
  subtotal: { section: "amounts", field: "net_amount_ex_vat" },
  vatAmount: { section: "amounts", field: "vat_amount" },
  grandTotal: { section: "amounts", field: "total_amount" },
  discountAmount: { section: "amounts", field: "discount_amount" },
  customerTaxId: { section: "customer", field: "tax_id" },
  referencePo: { section: "document", field: "reference_po" },
};

export function detectCorrections(
  ocrRaw: ExtractedData,
  editedFields: Record<string, unknown>,
  issuerTaxId: string
): Correction[] {
  const corrections: Correction[] = [];

  for (const [key, correctedValue] of Object.entries(editedFields)) {
    const mapping = FIELD_MAP[key];
    if (!mapping) continue;

    const section = ocrRaw[mapping.section as keyof ExtractedData];
    if (section === null || section === undefined || typeof section !== "object") continue;

    const originalValue = (section as unknown as Record<string, unknown>)[mapping.field];
    const originalStr = String(originalValue ?? "");
    const correctedStr = String(correctedValue ?? "");

    if (originalStr === correctedStr) continue;

    corrections.push({
      fieldName: `${mapping.section}_${mapping.field}`,
      originalValue: originalStr,
      correctedValue: correctedStr,
      triggerKey: issuerTaxId ? "issuer_tax_id" : "global",
      triggerValue: issuerTaxId || "all",
    });
  }

  return corrections;
}

export async function learnFromCorrections(
  tenantId: string,
  ocrRaw: ExtractedData,
  editedFields: Record<string, unknown>
): Promise<void> {
  const issuerTaxId = ocrRaw.issuer?.tax_id ?? "";
  const corrections = detectCorrections(ocrRaw, editedFields, issuerTaxId);

  for (const correction of corrections) {
    await upsertExtractionRule({
      tenantId,
      ruleType: "field_override",
      triggerKey: correction.triggerKey,
      triggerValue: correction.triggerValue,
      fieldName: correction.fieldName,
      ruleText: `When ${correction.triggerKey}=${correction.triggerValue}, field ${correction.fieldName} should be "${correction.correctedValue}" (was "${correction.originalValue}")`,
      deterministicValue: correction.correctedValue,
    });
  }
}
