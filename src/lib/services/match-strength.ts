/* eslint-disable @typescript-eslint/no-explicit-any */
export type TemplateShape = {
  id: string;
  journalTypes: string[];
  categoryKeywords: string[];
  direction: "REVENUE" | "EXPENSE";
};

export type BillLike = {
  journalType?: string | null;
  direction?: "REVENUE" | "EXPENSE" | null;
  ocrRaw?: Record<string, any> | null;
  issuerName?: string | null;
};

export const TEMPLATES: TemplateShape[] = [
  { id: "credit-sales", journalTypes: ["SV"], categoryKeywords: ["ขายเชื่อ", "ใบแจ้งหนี้", "invoice", "credit"], direction: "REVENUE" },
  { id: "cash-sales", journalTypes: ["RV"], categoryKeywords: ["ขายสด", "cash sales", "receipt", "ใบเสร็จรับเงิน"], direction: "REVENUE" },
  { id: "other-revenue", journalTypes: ["RV", "SV"], categoryKeywords: ["รายได้อื่นๆ", "other revenue"], direction: "REVENUE" },
  { id: "purchase-order", journalTypes: ["PurV"], categoryKeywords: ["ใบสั่งซื้อ", "po", "ใบเสนอราคา", "quotation"], direction: "EXPENSE" },
  { id: "other-expenses", journalTypes: ["PV"], categoryKeywords: ["ค่าใช้จ่ายอื่นๆ", "other", "รายจ่าย"], direction: "EXPENSE" },
  { id: "deposit-payment", journalTypes: ["PV"], categoryKeywords: ["มัดจำ", "deposit"], direction: "EXPENSE" },
  { id: "credit-purchase", journalTypes: ["PurV"], categoryKeywords: ["ซื้อเชื่อ", "ใบแจ้งหนี้", "invoice"], direction: "EXPENSE" },
  { id: "cash-purchase", journalTypes: ["PV"], categoryKeywords: ["ซื้อสด", "ใบเสร็จรับเงิน", "receipt"], direction: "EXPENSE" },
  {
    id: "petty-advance-clearing",
    journalTypes: ["JV"],
    categoryKeywords: ["ทดรอง", "petty", "advance clearing", "ชดเชยเงินสดย่อย"],
    direction: "EXPENSE",
  },
];

function getCategoryFromDocument(doc: BillLike) {
  const ocr = doc.ocrRaw || {};
  const raw = ocr?.line_items_pricing?.expense_category || ocr?.accounting?.expense_type;
  if (raw && typeof raw === "string") return raw;
  const lineItems = ocr?.line_items_pricing?.line_items || ocr?.line_items || [];
  const first = Array.isArray(lineItems) ? lineItems[0] : null;
  return typeof first === "string" ? first : first?.description || "";
}

function getDocumentName(doc: BillLike) {
  const ocr = doc.ocrRaw || {};
  const lines = ocr?.line_items_pricing?.line_items || ocr?.line_items || [];
  if (Array.isArray(lines) && lines.length > 0) {
    const parts = lines
      .slice(0, 3)
      .map((item: any) => (typeof item === "string" ? item : item?.description || item?.name || ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" - ");
  }
  return doc.issuerName || "Document";
}

export function computeTemplateMatchStrength(doc: BillLike, template: TemplateShape) {
  const journal = doc.journalType || "";
  const category = getCategoryFromDocument(doc).toLowerCase();
  const docName = getDocumentName(doc).toLowerCase();
  const direction = doc.direction || "EXPENSE";

  const directionMatch = direction === template.direction;
  const journalMatch = template.journalTypes.includes(journal);
  const keywordMatch = template.categoryKeywords.some((kw) => {
    const needle = kw.toLowerCase();
    return category.includes(needle) || docName.includes(needle);
  });

  if (directionMatch && journalMatch && keywordMatch) return "strong";
  if (directionMatch && (journalMatch || keywordMatch)) return "suitable";
  return "manual";
}

export function getBestMatchStrength(doc: BillLike, customTemplates?: TemplateShape[]) {
  const templates = customTemplates?.length ? customTemplates : TEMPLATES;
  const journal = doc.journalType || "";
  const relevant = templates.filter((t) => t.journalTypes.includes(journal));
  if (!relevant.length) return { strength: "manual" as const, templateId: "" };

  const order = { strong: 3, suitable: 2, manual: 1 };
  let best: { strength: "strong" | "suitable" | "manual"; templateId: string } = {
    strength: "manual",
    templateId: relevant[0].id,
  };

  for (const template of relevant) {
    const strength = computeTemplateMatchStrength(doc, template);
    if (order[strength] > order[best.strength]) {
      best = { strength, templateId: template.id };
    }
  }
  return best;
}

