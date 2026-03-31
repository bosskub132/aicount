import { parseThaiDate } from "./date-parser";
import { parseThaiNumber } from "./number-parser";
import type {
  ExtractedData,
  ExtractedIssuer,
  ExtractedCustomer,
  ExtractedDocument,
  ExtractedAmounts,
  ExtractedLineItem,
  ExtractionConfidence,
} from "../types";

/** Field weights for calculating weighted confidence */
const FIELD_WEIGHTS: Record<string, number> = {
  issuer_tax_id: 3.0,
  vat_amount: 3.0,
  document_type: 2.0,
  issuer_name: 1.5,
  invoice_date: 1.5,
  invoice_number: 1.0,
  total_amount: 1.0,
  net_amount_ex_vat: 0.5,
};

function safeString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value || null;
  return String(value);
}

function safeBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeIssuer(raw: Record<string, unknown>): ExtractedIssuer {
  return {
    name: safeString(raw.name),
    tax_id: safeString(raw.tax_id),
    branch_id: safeString(raw.branch_id),
    address: safeString(raw.address),
    postal_code: safeString(raw.postal_code),
  };
}

function normalizeCustomer(raw: Record<string, unknown>): ExtractedCustomer {
  return {
    name: safeString(raw.name),
    tax_id: safeString(raw.tax_id),
    branch_id: safeString(raw.branch_id),
    address: safeString(raw.address),
    postal_code: safeString(raw.postal_code),
  };
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDocument(raw: Record<string, unknown>): ExtractedDocument {
  const issueDate = raw.issue_date != null ? parseThaiDate(String(raw.issue_date)) : null;
  const dueDate = raw.due_date != null ? parseThaiDate(String(raw.due_date)) : null;
  const creditDays =
    raw.credit_days != null ? parseThaiNumber(raw.credit_days as string | number) : null;
  const rawCreditDueDate = raw.credit_due_date;

  let creditDueDate: string | null = null;
  if (rawCreditDueDate != null) {
    creditDueDate = parseThaiDate(String(rawCreditDueDate));
  } else if (issueDate != null && creditDays != null) {
    creditDueDate = addDays(issueDate, creditDays);
  }

  return {
    document_type: safeString(raw.document_type),
    invoice_number: safeString(raw.invoice_number),
    issue_date: issueDate,
    due_date: dueDate,
    credit_days: creditDays,
    credit_due_date: creditDueDate,
    reference_po: safeString(raw.reference_po),
  };
}

function normalizeAmounts(raw: Record<string, unknown>): ExtractedAmounts {
  return {
    net_amount_ex_vat: parseThaiNumber(raw.net_amount_ex_vat as string | number | null),
    vat_amount: parseThaiNumber(raw.vat_amount as string | number | null),
    total_amount: parseThaiNumber(raw.total_amount as string | number | null),
    discount_amount: parseThaiNumber(raw.discount_amount as string | number | null),
    currency: safeString(raw.currency) || "THB",
    is_vat_included: safeBoolean(raw.is_vat_included),
  };
}

function normalizeLineItems(raw: unknown): ExtractedLineItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => {
    const rec = safeRecord(item);
    return {
      description: safeString(rec.description) || "",
      quantity: parseThaiNumber(rec.quantity as string | number | null),
      unit_price: parseThaiNumber(rec.unit_price as string | number | null),
      discount: parseThaiNumber(rec.discount as string | number | null),
      total: parseThaiNumber(rec.total as string | number | null),
      category: safeString(rec.category),
    };
  });
}

function calculateWeightedConfidence(perField: Record<string, number>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    if (field in perField) {
      weightedSum += perField[field] * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 1000) / 1000;
}

function normalizeConfidence(raw: Record<string, unknown>): ExtractionConfidence {
  const overall =
    typeof raw.overall === "number" ? raw.overall : 0;
  const perField =
    raw.per_field != null && typeof raw.per_field === "object" && !Array.isArray(raw.per_field)
      ? (raw.per_field as Record<string, number>)
      : {};

  const weighted = calculateWeightedConfidence(perField);

  return {
    overall,
    weighted,
    per_field: perField,
  };
}

/**
 * Normalize a raw Claude API response into a structured ExtractedData object.
 * Converts Thai dates (Buddhist Era) and Thai number formats.
 */
export function normalizeClaudeResponse(
  raw: Record<string, unknown>
): ExtractedData {
  const issuerRaw = safeRecord(raw.issuer);
  const customerRaw = safeRecord(raw.customer);
  const documentRaw = safeRecord(raw.document);
  const amountsRaw = safeRecord(raw.amounts);
  const confidenceRaw = safeRecord(raw.confidence);

  return {
    issuer: normalizeIssuer(issuerRaw),
    customer: normalizeCustomer(customerRaw),
    document: normalizeDocument(documentRaw),
    amounts: normalizeAmounts(amountsRaw),
    line_items: normalizeLineItems(raw.line_items),
    confidence: normalizeConfidence(confidenceRaw),
  };
}
