export interface ExtractedIssuer {
  name: string | null;
  tax_id: string | null;
  branch_id: string | null;
  address: string | null;
  postal_code: string | null;
}

export interface ExtractedCustomer {
  name: string | null;
  tax_id: string | null;
  branch_id: string | null;
  address: string | null;
  postal_code: string | null;
}

export interface ExtractedDocument {
  document_type: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  credit_days: number | null;
  credit_due_date: string | null;
  reference_po: string | null;
}

export interface ExtractedAmounts {
  net_amount_ex_vat: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  discount_amount: number | null;
  currency: string;
  is_vat_included: boolean | null;
}

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  discount: number | null;
  total: number | null;
  category: string | null;
}

export interface ExtractionConfidence {
  overall: number;
  weighted: number;
  per_field: Record<string, number>;
}

export interface ExtractedData {
  issuer: ExtractedIssuer;
  customer: ExtractedCustomer;
  document: ExtractedDocument;
  amounts: ExtractedAmounts;
  line_items: ExtractedLineItem[];
  confidence: ExtractionConfidence;
}

export interface LineItemValidation {
  isValid: boolean;
  failures: { index: number; expected: number; got: number }[];
}

export interface AmountCheck {
  isValid: boolean;
  expected: number | null;
  got: number | null;
}

export interface ValidationResult {
  lineItemCheck: LineItemValidation;
  subtotalCheck: AmountCheck;
  vatCheck: AmountCheck;
  grandTotalCheck: AmountCheck;
  overallValid: boolean;
}

export interface TierResult {
  tier: 1 | 2 | 3;
  data: ExtractedData;
  validation: ValidationResult;
  escalationReasons: string[];
  costUsd: number;
}

export interface ExtractionResult {
  data: ExtractedData;
  tierUsed: 1 | 2 | 3;
  allTierResults: TierResult[];
  validation: ValidationResult;
  escalationReasons: string[];
  totalCostUsd: number;
}

export interface LearnedRule {
  id: string;
  tenantId: string | null;
  ruleType: string;
  triggerKey: string;
  triggerValue: string;
  fieldName: string;
  ruleText: string;
  deterministicValue: string | null;
  sampleCount: number;
  confidence: number;
  isGraduated: boolean;
}
