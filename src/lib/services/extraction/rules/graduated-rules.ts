import type { ExtractedData, LearnedRule } from "../types";

const FIELD_PATH_MAP: Record<string, { section: string; field: string }> = {
  issuer_name: { section: "issuer", field: "name" },
  issuer_tax_id: { section: "issuer", field: "tax_id" },
  issuer_branch_id: { section: "issuer", field: "branch_id" },
  issuer_address: { section: "issuer", field: "address" },
  issuer_postal_code: { section: "issuer", field: "postal_code" },
  customer_name: { section: "customer", field: "name" },
  customer_tax_id: { section: "customer", field: "tax_id" },
  customer_branch_id: { section: "customer", field: "branch_id" },
  customer_address: { section: "customer", field: "address" },
  customer_postal_code: { section: "customer", field: "postal_code" },
  document_invoice_number: { section: "document", field: "invoice_number" },
  document_issue_date: { section: "document", field: "issue_date" },
  document_reference_po: { section: "document", field: "reference_po" },
  amounts_net_amount_ex_vat: { section: "amounts", field: "net_amount_ex_vat" },
  amounts_vat_amount: { section: "amounts", field: "vat_amount" },
  amounts_total_amount: { section: "amounts", field: "total_amount" },
  amounts_discount_amount: { section: "amounts", field: "discount_amount" },
};

export function applyGraduatedRules(
  data: ExtractedData,
  graduatedRules: LearnedRule[]
): ExtractedData {
  if (graduatedRules.length === 0) return data;

  // Deep clone to avoid mutation
  const result: ExtractedData = JSON.parse(JSON.stringify(data));

  for (const rule of graduatedRules) {
    if (!rule.deterministicValue) continue;

    const pathMapping = FIELD_PATH_MAP[rule.fieldName];
    if (!pathMapping) continue;

    const section = result[pathMapping.section as keyof ExtractedData];
    if (section === null || section === undefined || typeof section !== "object") continue;

    (section as unknown as Record<string, unknown>)[pathMapping.field] = rule.deterministicValue;

    // Set per_field confidence to 0.99
    const confidenceKey = `${pathMapping.section}.${pathMapping.field}`;
    result.confidence.per_field[confidenceKey] = 0.99;
  }

  return result;
}
