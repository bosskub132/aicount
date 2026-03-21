export const DOCUMENT_STATUSES = [
  "DRAFT",
  "OCR_PROCESSING",
  "QUERY",
  "ACTION_REQUIRED",
  "PENDING_APPROVAL",
  "REJECTED",
  "APPROVED",
  "EXPORTED",
  "VOID",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const JOURNAL_TYPES = ["RV", "SV", "PV", "PurV", "JV"] as const;
export type JournalType = (typeof JOURNAL_TYPES)[number];

export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
  RV: "Receipt Journal (ขายสด/รับเงิน)",
  SV: "Sales Journal (ขายเชื่อ)",
  PV: "Payment Journal (ซื้อสด/จ่ายเงิน)",
  PurV: "Purchase Journal (ซื้อเชื่อ)",
  JV: "General Journal (รายการพิเศษ)",
};

export const DOC_TYPES = [
  "RECEIPT",
  "INVOICE",
  "PO",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "OTHER",
] as const;

export const WHT_RATES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

export const ACCOUNT_CATEGORIES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;

export const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ["OCR_PROCESSING"],
  OCR_PROCESSING: ["QUERY", "ACTION_REQUIRED", "PENDING_APPROVAL"],
  QUERY: ["ACTION_REQUIRED", "PENDING_APPROVAL"],
  ACTION_REQUIRED: ["PENDING_APPROVAL"],
  PENDING_APPROVAL: ["REJECTED", "APPROVED"],
  REJECTED: ["ACTION_REQUIRED", "PENDING_APPROVAL"],
  APPROVED: ["EXPORTED"],
  EXPORTED: [],
  VOID: [],
};
