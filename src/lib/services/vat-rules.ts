import { calculateWeightedConfidence } from "@/lib/services/confidence";

const HANDWRITTEN_THRESHOLD = 0.2;
const CONFIDENCE_AUTO_APPROVE = 0.85;
const CONFIDENCE_MANUAL_REVIEW = 0.7;

const normalizeDocType = (value: unknown) => String(value || "").trim().toUpperCase();

const isWithinSixMonths = (dateValue: unknown) => {
  if (!dateValue) return false;
  const date = new Date(String(dateValue));
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  return date >= sixMonthsAgo;
};

type RuleInput = {
  fields: Record<string, { value?: unknown; confidence?: number }>;
  meta?: { handwritten_ratio?: number; tenant_tax_id?: string };
};

export function classifyExpense({ fields, meta }: RuleInput) {
  const failureReasons: string[] = [];

  if ((meta?.handwritten_ratio ?? 0) >= HANDWRITTEN_THRESHOLD) {
    return {
      classification: "NON_VAT_INFORMAL_EXPENSE",
      vat_credit_allowed: false,
      reason: "HANDWRITTEN_DOCUMENT",
      failureReasons: ["HANDWRITTEN_DOCUMENT"],
      decision: "MANUAL_REVIEW",
    };
  }

  const documentType = normalizeDocType(fields.document_type?.value);
  if (!documentType.includes("TAX_INVOICE") && !documentType.includes("ใบกำกับภาษี".toUpperCase())) {
    failureReasons.push("NOT_TAX_INVOICE");
  }

  if (!fields.issuer_tax_id?.value || String(fields.issuer_tax_id.value).replace(/\D/g, "").length !== 13) {
    failureReasons.push("MISSING_OR_INVALID_ISSUER_TAX_ID");
  }

  const hasTenantTaxId = String(meta?.tenant_tax_id || "").replace(/\D/g, "").length === 13;
  if (!hasTenantTaxId) {
    failureReasons.push("MISSING_TENANT_TAX_ID");
  }

  if (!isWithinSixMonths(fields.invoice_date?.value)) {
    failureReasons.push("OUTSIDE_6_MONTH_WINDOW");
  }

  if (failureReasons.length) {
    return {
      classification: "NON_VAT_INFORMAL_EXPENSE",
      vat_credit_allowed: false,
      reason: failureReasons[0],
      failureReasons,
      decision: "MANUAL_REVIEW",
    };
  }

  const confidence = calculateWeightedConfidence(fields);

  if (confidence >= CONFIDENCE_AUTO_APPROVE) {
    return {
      classification: "VAT_EXPENSE",
      vat_credit_allowed: true,
      confidence,
      decision: "AUTO_APPROVE",
      failureReasons: [],
    };
  }

  if (confidence >= CONFIDENCE_MANUAL_REVIEW) {
    return {
      classification: "VAT_EXPENSE",
      vat_credit_allowed: false,
      confidence,
      decision: "MANUAL_REVIEW",
      failureReasons: ["MANUAL_REVIEW_REQUIRED"],
    };
  }

  return {
    classification: "NON_VAT_INFORMAL_EXPENSE",
    vat_credit_allowed: false,
    confidence,
    reason: "LOW_CONFIDENCE",
    failureReasons: ["LOW_CONFIDENCE"],
    decision: "MANUAL_REVIEW",
  };
}

