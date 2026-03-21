/* eslint-disable @typescript-eslint/no-explicit-any */
/** Advance / petty cash clearing — blueprint: JV with multi-line Dr expenses, Cr advance/petty (system uses single expense line until line-level OCR is richer). */
const pettyAdvanceClearingKeywords = [
  "ใบเบิกเงินทดรอง",
  "เงินทดรองจ่าย",
  "ชดเชยเงินสดย่อย",
  "petty cash",
  "advance clearing",
  "clearing advance",
];

const expensePaidKeywords = ["ใบเสร็จรับเงิน", "receipt", "บิลเงินสด"];
const expenseUnpaidKeywords = ["ใบแจ้งหนี้", "invoice", "ใบส่งของ"];
const pendingMatchKeywords = ["ใบสั่งซื้อ", "po", "ใบเสนอราคา", "quotation"];
const creditNoteKeywords = ["ใบลดหนี้", "credit note"];
const debitNoteKeywords = ["ใบเพิ่มหนี้", "debit note"];
const vatExemptKeywords = ["ยกเว้นภาษี", "vat exempt", "ไม่คิด vat"];
const zeroRatedKeywords = ["zero-rated", "0%", "vat 0"];

const hasAnyKeyword = (text: string, keywords: string[]) => {
  const normalized = String(text || "").toLowerCase();
  return keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
};

const toTextForDetection = ({
  extractedData,
  billType,
}: {
  extractedData: Record<string, any>;
  billType?: string | null;
}) => {
  const doc = extractedData?.document || {};
  const rawLines = extractedData?.line_items_pricing?.line_items || extractedData?.line_items || [];
  const lineText = Array.isArray(rawLines)
    ? rawLines
        .map((line) => (typeof line === "string" ? line : line?.description || ""))
        .join(" ")
    : "";

  return [doc.document_type, doc.invoice_number, extractedData?.additional_information?.notes, billType, lineText]
    .filter(Boolean)
    .join(" ");
};

export function classifyTransaction({
  tenantTaxId,
  issuerTaxId,
  extractedData,
  billType,
}: {
  tenantTaxId?: string | null;
  issuerTaxId?: string | null;
  extractedData: Record<string, any>;
  billType?: string | null;
}) {
  const normalizedTenantTaxId = String(tenantTaxId || "").replace(/\D/g, "");
  const normalizedIssuerTaxId = String(issuerTaxId || "").replace(/\D/g, "");
  const direction = normalizedTenantTaxId && normalizedTenantTaxId === normalizedIssuerTaxId ? "REVENUE" : "EXPENSE";

  const text = toTextForDetection({ extractedData, billType });
  const isCreditNote = hasAnyKeyword(text, creditNoteKeywords);
  const isDebitNote = hasAnyKeyword(text, debitNoteKeywords);
  const isPendingMatch = hasAnyKeyword(text, pendingMatchKeywords);
  const vatMode = hasAnyKeyword(text, zeroRatedKeywords)
    ? "ZERO_RATED"
    : hasAnyKeyword(text, vatExemptKeywords)
      ? "VAT_EXEMPT"
      : "NORMAL_VAT";

  if (direction === "REVENUE") {
    const isCredit = hasAnyKeyword(text, ["invoice", "ใบแจ้งหนี้", "credit"]);
    return {
      direction,
      journalType: isCredit ? "SV" : "RV",
      pendingMatch: false,
      isCreditNote,
      isDebitNote,
      shouldPostGL: true,
      docType: isCreditNote ? "CREDIT_NOTE" : isDebitNote ? "DEBIT_NOTE" : "INVOICE",
      vatMode,
    };
  }

  if (isPendingMatch) {
    return {
      direction,
      journalType: null,
      pendingMatch: true,
      isCreditNote: false,
      isDebitNote: false,
      shouldPostGL: false,
      docType: "PO",
      vatMode,
    };
  }

  if (isCreditNote) {
    return {
      direction,
      journalType: "PurV",
      pendingMatch: false,
      isCreditNote: true,
      isDebitNote: false,
      shouldPostGL: true,
      docType: "CREDIT_NOTE",
      vatMode,
    };
  }

  if (isDebitNote) {
    return {
      direction,
      journalType: "PurV",
      pendingMatch: false,
      isCreditNote: false,
      isDebitNote: true,
      shouldPostGL: true,
      docType: "DEBIT_NOTE",
      vatMode,
    };
  }

  if (hasAnyKeyword(text, pettyAdvanceClearingKeywords)) {
    return {
      direction,
      journalType: "JV",
      pendingMatch: false,
      isCreditNote: false,
      isDebitNote: false,
      shouldPostGL: true,
      docType: "OTHER",
      vatMode,
    };
  }

  if (hasAnyKeyword(text, expensePaidKeywords)) {
    return {
      direction,
      journalType: "PV",
      pendingMatch: false,
      isCreditNote: false,
      isDebitNote: false,
      shouldPostGL: true,
      docType: "RECEIPT",
      vatMode,
    };
  }

  if (hasAnyKeyword(text, expenseUnpaidKeywords)) {
    return {
      direction,
      journalType: "PurV",
      pendingMatch: false,
      isCreditNote: false,
      isDebitNote: false,
      shouldPostGL: true,
      docType: "INVOICE",
      vatMode,
    };
  }

  return {
    direction,
    journalType: "PV",
    pendingMatch: false,
    isCreditNote: false,
    isDebitNote: false,
    shouldPostGL: true,
    docType: "OTHER",
    vatMode,
  };
}

