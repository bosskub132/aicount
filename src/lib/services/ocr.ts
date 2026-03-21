/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { classifyExpense } from "@/lib/services/vat-rules";
import { calculateWeightedConfidence } from "@/lib/services/confidence";
import { validateAmountEquation } from "@/lib/services/math-validation";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const promptCache = new Map<string, string>();

async function readPromptFile(fileName: "tier1_prompt" | "tier2_prompt") {
  if (promptCache.has(fileName)) return promptCache.get(fileName)!;
  const promptPath = path.join(process.cwd(), "src", "lib", "services", "prompts", fileName);
  const content = await fs.readFile(promptPath, "utf8");
  promptCache.set(fileName, content);
  return content;
}

function parseClaudeJson(rawText: string) {
  const jsonText = rawText.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  try {
    return JSON.parse(jsonText);
  } catch {
    return {};
  }
}

function getFieldValue(fields: Record<string, any>, key: string) {
  return fields?.[key]?.value ?? null;
}

function getFieldConfidence(fields: Record<string, any>, key: string) {
  const value = fields?.[key]?.confidence;
  return typeof value === "number" ? value : 0;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isVatCandidate(tier1: Record<string, any>) {
  const vatAmount = Number(getFieldValue(tier1, "vat_amount") || 0);
  const isHandwritten = Boolean(getFieldValue(tier1, "is_handwritten"));
  const issuerTaxId = getFieldValue(tier1, "issuer_tax_id");
  return vatAmount > 0 && !isHandwritten && Boolean(issuerTaxId);
}

function mapFieldsForVatRules(tier1: Record<string, any>, tier2: Record<string, any>) {
  return {
    document_type: {
      value: String(getFieldValue(tier1, "document_type_keyword") || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_"),
      confidence: getFieldConfidence(tier1, "document_type_keyword"),
    },
    issuer_tax_id: {
      value: getFieldValue(tier1, "issuer_tax_id"),
      confidence: getFieldConfidence(tier1, "issuer_tax_id"),
    },
    issuer_name: {
      value: getFieldValue(tier2, "issuer_name"),
      confidence: getFieldConfidence(tier2, "issuer_name"),
    },
    invoice_date: {
      value: getFieldValue(tier1, "invoice_date"),
      confidence: getFieldConfidence(tier1, "invoice_date"),
    },
    invoice_number: {
      value: getFieldValue(tier2, "invoice_number"),
      confidence: getFieldConfidence(tier2, "invoice_number"),
    },
    vat_amount: {
      value: toNumber(getFieldValue(tier1, "vat_amount")),
      confidence: getFieldConfidence(tier1, "vat_amount"),
    },
    net_amount_ex_vat: {
      value: toNumber(getFieldValue(tier2, "net_amount_ex_vat")),
      confidence: getFieldConfidence(tier2, "net_amount_ex_vat"),
    },
    total_amount: {
      value: toNumber(getFieldValue(tier2, "total_amount") ?? getFieldValue(tier1, "total_amount")),
      confidence: getFieldConfidence(tier2, "total_amount") || getFieldConfidence(tier1, "total_amount"),
    },
  };
}

function mapConfidenceFields(tier1: Record<string, any>, tier2: Record<string, any>) {
  return {
    document_type: getFieldConfidence(tier1, "document_type_keyword"),
    issuer_tax_id: getFieldConfidence(tier1, "issuer_tax_id"),
    issuer_name: getFieldConfidence(tier2, "issuer_name"),
    invoice_date: getFieldConfidence(tier1, "invoice_date"),
    invoice_number: getFieldConfidence(tier2, "invoice_number"),
    vat_amount: getFieldConfidence(tier1, "vat_amount"),
    net_amount_ex_vat: getFieldConfidence(tier2, "net_amount_ex_vat"),
    total_amount: getFieldConfidence(tier2, "total_amount") || getFieldConfidence(tier1, "total_amount"),
  };
}

function buildResponse({
  tier1,
  tier2,
  earlyTerminated,
}: {
  tier1: Record<string, any>;
  tier2?: Record<string, any>;
  earlyTerminated: boolean;
}) {
  const t2 = tier2 || {};
  const fieldsForRules = mapFieldsForVatRules(tier1, t2);
  const ruleEval = classifyExpense({
    fields: fieldsForRules,
    meta: {
      handwritten_ratio: getFieldValue(tier1, "is_handwritten") ? 1 : 0,
      tenant_tax_id: process.env.DEFAULT_TENANT_TAX_ID || "",
    },
  });

  const netAmountExVat = toNumber(getFieldValue(t2, "net_amount_ex_vat"));
  const vatAmount = toNumber(getFieldValue(tier1, "vat_amount"));
  const totalAmount = toNumber(getFieldValue(t2, "total_amount") ?? getFieldValue(tier1, "total_amount"));
  const mathValidation = validateAmountEquation({
    subtotal: netAmountExVat,
    vat: vatAmount,
    grandTotal: totalAmount,
  });
  const hasMinimumSignal = Boolean(
    getFieldValue(tier1, "issuer_tax_id") ||
      getFieldValue(tier1, "invoice_date") ||
      totalAmount ||
      netAmountExVat
  );
  const lowQuality = !hasMinimumSignal || (tier2 && Object.keys(tier2).length === 0);

  return {
    ocr_version: "th-vat-optimized-v1",
    processing: {
      ocr_tier_used: earlyTerminated ? 1 : 2,
      early_terminated: earlyTerminated,
      low_quality: lowQuality,
      needs_rotation_review: !hasMinimumSignal,
    },
    document: {
      document_type: getFieldValue(tier1, "document_type_keyword"),
      issue_date: getFieldValue(tier1, "invoice_date"),
      invoice_number: getFieldValue(t2, "invoice_number") ?? getFieldValue(tier1, "invoice_number"),
      credit_days: getFieldValue(t2, "credit_days"),
      due_date: getFieldValue(t2, "credit_due_date"),
    },
    issuer: {
      name: getFieldValue(t2, "issuer_name") ?? getFieldValue(tier1, "issuer_name"),
      tax_id: getFieldValue(tier1, "issuer_tax_id"),
      address: getFieldValue(t2, "issuer_address") ?? getFieldValue(tier1, "issuer_address"),
      postal_code: getFieldValue(t2, "issuer_postal_code") ?? getFieldValue(tier1, "issuer_postal_code"),
      branch_id: getFieldValue(t2, "issuer_branch_id") ?? getFieldValue(tier1, "issuer_branch_id"),
    },
    customer: {
      name: getFieldValue(t2, "customer_name"),
      address: getFieldValue(t2, "customer_address"),
      postal_code: getFieldValue(t2, "customer_postal_code"),
      branch_id: getFieldValue(t2, "customer_branch_id"),
    },
    amounts: {
      net_amount_ex_vat: netAmountExVat,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      currency: getFieldValue(t2, "currency") ?? getFieldValue(tier1, "currency") ?? "THB",
    },
    line_items: getFieldValue(t2, "line_items") || [],
    confidence: {
      overall: mathValidation.isValid ? 0.95 : 0.4,
      weighted: calculateWeightedConfidence(fieldsForRules),
      per_field: mapConfidenceFields(tier1, t2),
    },
    validation: {
      amount_equation: mathValidation,
    },
    accounting: {
      expense_type: ruleEval.classification === "VAT_EXPENSE" ? "VAT_INVOICE" : "NON_VAT_INFORMAL",
      requires_manual_review: ruleEval.decision === "MANUAL_REVIEW",
      failure_reasons: ruleEval.failureReasons || [],
      vat_mode:
        vatAmount === 0
          ? (String(getFieldValue(t2, "notes") || "").toLowerCase().includes("exempt") ? "VAT_EXEMPT" : "ZERO_RATED")
          : "NORMAL_VAT",
      is_vat_included: getFieldValue(t2, "is_vat_included"),
      notes: getFieldValue(t2, "notes"),
    },
  };
}

function extractFromGoogleVisionText(rawText: string) {
  const normalized = String(rawText || "");
  const taxIdMatch = normalized.match(/\b\d{1,2}-?\d{4}-?\d{5}-?\d{2}-?\d\b|\b\d{13}\b/);
  const invoiceNoMatch = normalized.match(
    /\b(?:INV|RECEIPT|BILL|TAX)[\s\-:/]*([A-Z0-9\-_/]{3,40})\b/i
  );
  const dateMatch = normalized.match(/\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
  const totalMatch = normalized.match(/(?:total|grand total|จำนวนเงินรวม)[^\d]*(\d[\d,]*\.?\d{0,2})/i);
  const vatMatch = normalized.match(/(?:vat|ภาษีมูลค่าเพิ่ม)[^\d]*(\d[\d,]*\.?\d{0,2})/i);
  const subtotalMatch = normalized.match(/(?:subtotal|ก่อนภาษี|มูลค่าสินค้า)[^\d]*(\d[\d,]*\.?\d{0,2})/i);

  // Extract issuer name - typically the first prominent line or after "บริษัท"/"ห้างหุ้นส่วน"
  const issuerNameMatch = normalized.match(/(?:บริษัท|ห้างหุ้นส่วน|Company|Co\.,?\s*Ltd\.?)\s*(.{3,80}?)(?:\n|$)/i);

  // Extract branch ID
  const branchMatch = normalized.match(/(?:สำนักงานใหญ่|สาขา(?:เลขที่|ที่)?)\s*(\S{0,30})/i);

  // Extract address - look for Thai address patterns (number, road, district, province)
  const addressMatch = normalized.match(
    /(?:ที่อยู่|address|เลขที่)\s*[:.]?\s*(.{10,150}?)(?:\n|รหัสไปรษณีย์|postal|tax\s*id|เลขประจำตัว)/i
  ) || normalized.match(
    /(\d{1,5}(?:\/\d+)?\s+(?:ม\.|หมู่|ซ\.|ซอย|ถ\.|ถนน|แขวง|เขต|ตำบล|อำเภอ|จังหวัด|Moo|Soi|Road|Rd\.?).{5,120}?)(?:\n|$)/i
  );

  // Extract postal code - Thai postal codes are 5 digits
  const postalMatch = normalized.match(/(?:รหัสไปรษณีย์|postal\s*code?|zip)\s*[:.]?\s*(\d{5})/i)
    || normalized.match(/\b(\d{5})\b(?=\s*(?:โทร|tel|fax|phone|ประเทศ|thailand|\n))/i);

  // Extract credit days
  const creditDaysMatch = normalized.match(/(?:credit|เครดิต)\s*(?:term|days|วัน)?\s*[:.]?\s*(\d{1,3})\s*(?:days|วัน)?/i);

  // Extract due date
  const dueDateMatch = normalized.match(/(?:due\s*date|วันครบกำหนด|กำหนดชำระ)\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i);

  // Extract customer name
  const customerNameMatch = normalized.match(/(?:ลูกค้า|customer|นาม|ชื่อผู้ซื้อ|sold\s*to|bill\s*to)\s*[:.]?\s*(.{3,80}?)(?:\n|$)/i);

  // Extract customer address
  const customerAddressMatch = normalized.match(
    /(?:ที่อยู่ผู้ซื้อ|customer\s*address|ship\s*to|deliver\s*to)\s*[:.]?\s*(.{10,150}?)(?:\n|รหัส|postal|tax)/i
  );

  // Extract customer postal code
  const customerPostalMatch = normalized.match(/(?:ที่อยู่ผู้ซื้อ|customer|ship|deliver)[\s\S]{10,200}?(\d{5})(?=\s*(?:\n|โทร|tel|$))/i);

  // Extract customer branch ID
  const customerBranchMatch = normalized.match(/(?:ผู้ซื้อ|customer|buyer)[\s\S]{0,100}?(?:สำนักงานใหญ่|สาขา(?:เลขที่|ที่)?)\s*(\S{0,30})/i);

  // Extract notes / remarks
  const notesMatch = normalized.match(/(?:หมายเหตุ|remarks?|notes?)\s*[:.]?\s*(.{3,200}?)(?:\n\n|\n(?=[A-Z\u0E00]))/i);

  // Extract is_vat_included hint
  const vatIncludedMatch = normalized.match(/(?:รวม\s*(?:ภาษี|vat)|vat\s*included|including\s*vat)/i);
  const vatExcludedMatch = normalized.match(/(?:ไม่รวม\s*(?:ภาษี|vat)|vat\s*excluded|excluding\s*vat|before\s*vat)/i);

  // Extract line items using generic OCR line-item parser.
  // Handles all Thai receipt formats: block-style, sequential, name-block, and hybrid.
  const lineItems: Array<{ description: string; quantity: number | null; unit_price: number | null; total: number | null }> = [];
  const lines = normalized.split("\n");

  const parseNum = (s: string) => {
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  // ── Generic OCR Line-Item Parser ──
  // Classifies every line, then extracts items using whichever pattern the receipt uses.
  // Works across block-style, sequential, name-block, and hybrid receipts.

  const summaryPattern = /(?:total|subtotal|vat\s|ภาษี|รวม|ยอด|สุทธิ|net\b|grand|discount|ส่วนลด|amount\s*(?:included|excluded)|หมายเหตุ|remarks?|issue\s*at|เป็นการ|words?:|ผู้จัดทำ|ผู้รับเงิน|สถานะ|ชำระเงิน|payment|SUBTOTAL|สินค้าซื้อแล้ว)/i;
  const headerKeywords = [
    { re: /(?:description|รายการ(?:สินค้า)?|item\b)/i, col: "desc" },
    { re: /(?:quantity|ปริมาณ|จำนวน|จํานวน(?:สินค้า)?|qty)/i, col: "qty" },
    { re: /(?:unit\s*price|ราคา.*(?:หน.*วย|ต่อ)|price)/i, col: "price" },
    { re: /(?:ส.*วนลด|discount)/i, col: "discount" },
    { re: /(?:จำนวนเงิน|จํานวนเงิน|amount)/i, col: "amount" },
    { re: /(?:ประเภทภาษี|tax\s*type)/i, col: "taxtype" },
  ];
  const isHeaderLine = (s: string) => headerKeywords.some((kw) => kw.re.test(s));
  const stopPattern = /(?:total\s*amount|รวมทั้งสิ้น|รวมทั้งหมด|จํานวนเงินรวม|จำนวนเงินรวม|สินค้าที่ยกเว้น|สินค้าที่เสีย|V\s*(?:สินค้า|ภาษี)|ชำระเงิน|payment|net\s*amount|net\s*total|issue\s*at|หมายเหตุ|remarks|SUBTOTAL\s)/i;

  // Helper: strip trailing V/N tax flag from number lines ("199.00 V" → "199.00")
  const stripTaxFlag = (s: string) => s.replace(/\s+[VN]\s*$/i, "").trim();
  const isNumericLine = (s: string) => {
    const cleaned = stripTaxFlag(s);
    return /^[\d,.\s]+$/.test(cleaned) && /\d/.test(cleaned);
  };
  const extractNums = (s: string): number[] => {
    const cleaned = stripTaxFlag(s);
    return (cleaned.match(/\d[\d,]*\.?\d*/g) || [])
      .map((n) => parseNum(n)!)
      .filter((n) => n !== null && !isNaN(n));
  };

  // ── Step 1: Classify every line ──
  type Tag = "barcode" | "header" | "stop" | "number" | "product_code" | "product_name" | "skip";
  type Tagged = { tag: Tag; raw: string; nums?: number[]; desc?: string; idx: number };
  const tagged: Tagged[] = [];

  const barcodePattern = /^0?\d{12,13}$/; // EAN-13 barcodes
  const productCodePrefixPattern = /^(?:[VN]\s+)?(?:[\d]{4,}[\s|@]|CP\d+[_])/;
  const productNameChars = /[\u0E00-\u0E7FA-Za-z]/;
  // Product name: has Thai/English text AND often a size/unit indicator
  const productSizePattern = /\d+\s*(?:กรัม|กก|ก\.|ml|ML|mL|g|G|L|ลิตร|มล|ซม|oz|kg|mg|cc|ม้วน|แผ่น|ชิ้น)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.length < 2) continue;

    if (stopPattern.test(trimmed)) { tagged.push({ tag: "stop", raw: trimmed, idx: i }); break; }
    if (isHeaderLine(trimmed)) { tagged.push({ tag: "header", raw: trimmed, idx: i }); continue; }
    if (barcodePattern.test(trimmed)) { tagged.push({ tag: "barcode", raw: trimmed, idx: i }); continue; }
    if (isNumericLine(trimmed)) {
      tagged.push({ tag: "number", raw: trimmed, nums: extractNums(trimmed), idx: i });
      continue;
    }
    // Product code + description on same line
    if (productCodePrefixPattern.test(trimmed)) {
      const cleaned = trimmed
        .replace(/^(?:[VN]\s+)?/, "")
        .replace(/^[\d]{4,}\s*[|@]?\s*/, "")
        .replace(/^CP\d+[_]+\d*[_]*/i, "")
        .replace(/[@$_|]/g, "")
        .trim();
      if (cleaned.length >= 2) {
        tagged.push({ tag: "product_code", raw: trimmed, desc: cleaned, idx: i });
        continue;
      }
    }
    // Product name: contains Thai/English text, not a structural line
    if (productNameChars.test(trimmed) && !summaryPattern.test(trimmed) && trimmed.length >= 4) {
      // Clean CP-style prefixes from standalone names too
      const cleaned = trimmed.replace(/^(?:S_|CP\d+[_]+\d*[_]*)/i, "").trim();
      if (cleaned.length >= 3 && (productSizePattern.test(cleaned) || /[\u0E00-\u0E7F]/.test(cleaned))) {
        tagged.push({ tag: "product_name", raw: trimmed, desc: cleaned, idx: i });
        continue;
      }
    }
    tagged.push({ tag: "skip", raw: trimmed, idx: i });
  }

  // ── Step 2: Detect column count from all header lines ──
  const allHeaderText = tagged.filter((t) => t.tag === "header").map((t) => t.raw).join(" ");
  const detectedCols = new Set<string>();
  for (const kw of headerKeywords) { if (kw.re.test(allHeaderText)) detectedCols.add(kw.col); }
  const hasDiscount = detectedCols.has("discount");
  const hasTaxType = detectedCols.has("taxtype");

  // ── Step 3: Find product descriptions (from entire document) ──
  // Try coded descriptions first, then name blocks
  const codedDescs = tagged.filter((t) => t.tag === "product_code" && t.desc).map((t) => t.desc!);

  // Find consecutive product_name blocks
  const nameBlocks: string[][] = [];
  let curBlock: string[] = [];
  for (const t of tagged) {
    if (t.tag === "product_name" && t.desc) {
      curBlock.push(t.desc);
    } else {
      if (curBlock.length >= 2) nameBlocks.push([...curBlock]);
      curBlock = [];
    }
  }
  if (curBlock.length >= 2) nameBlocks.push([...curBlock]);

  const allDescriptions = codedDescs.length > 0
    ? codedDescs
    : nameBlocks.length > 0
      ? nameBlocks.reduce((best, b) => b.length > best.length ? b : best, [])
      : [];

  // ── Step 4: Collect numbers after the LAST header line ──
  const lastHeaderTagIdx = tagged.reduce((acc, t, i) => t.tag === "header" ? i : acc, -1);
  const numTags = tagged.filter((_, i) => i > lastHeaderTagIdx).filter((t) => t.tag === "number");
  const allNums: number[] = [];
  for (const t of numTags) { if (t.nums) allNums.push(...t.nums); }

  // ── Step 5: Block-style zip ──
  if (allDescriptions.length > 0 && allNums.length >= allDescriptions.length) {
    // Infer columns per row
    let colsPerRow: number;
    if (allNums.length % allDescriptions.length === 0) {
      colsPerRow = allNums.length / allDescriptions.length;
      if (colsPerRow > 5) colsPerRow = 3; // sanity cap
    } else {
      // Try common column counts: 3, 2, 4
      colsPerRow = [3, 2, 4].find((c) => {
        const rows = Math.floor(allNums.length / c);
        return rows >= allDescriptions.length;
      }) || 3;
    }

    // Detect tax flag / type column (values always 0 or 1)
    let taxFlagCols = 0;
    if (colsPerRow >= 3 && (hasTaxType || true)) {
      // Check from last column backwards
      for (let col = colsPerRow - 1; col >= 2; col--) {
        const colValues: number[] = [];
        for (let i = col; i < allNums.length; i += colsPerRow) colValues.push(allNums[i]);
        if (colValues.length > 0 && colValues.every((v) => v <= 2 && Number.isInteger(v))) {
          taxFlagCols++;
        } else {
          break;
        }
      }
    }
    const effectiveCols = colsPerRow - taxFlagCols;

    const numberRows: Array<{ qty: number | null; unitPrice: number | null; total: number | null }> = [];
    for (let i = 0; i < allNums.length; i += colsPerRow) {
      const row = allNums.slice(i, i + colsPerRow);
      if (row.length < effectiveCols) break;

      if (hasDiscount && effectiveCols >= 4) {
        numberRows.push({ qty: row[0], unitPrice: row[1], total: row[3] });
      } else if (effectiveCols >= 3) {
        numberRows.push({ qty: row[0], unitPrice: row[1], total: row[effectiveCols - 1] });
      } else if (effectiveCols === 2) {
        numberRows.push({ qty: null, unitPrice: row[0], total: row[1] });
      } else {
        numberRows.push({ qty: null, unitPrice: null, total: row[0] });
      }
    }

    const count = Math.min(allDescriptions.length, numberRows.length);
    for (let i = 0; i < count; i++) {
      lineItems.push({
        description: allDescriptions[i],
        quantity: numberRows[i].qty,
        unit_price: numberRows[i].unitPrice,
        total: numberRows[i].total,
      });
    }
  }

  // ── Step 6: Sequential / interleaved fallback ──
  // Walk tagged lines after the last header: group desc+numbers into items.
  if (lineItems.length === 0 && lastHeaderTagIdx >= 0) {
    type ItemBlock = { descParts: string[]; nums: number[] };
    const items: ItemBlock[] = [];
    let cur: ItemBlock | null = null;

    for (let i = lastHeaderTagIdx + 1; i < tagged.length; i++) {
      const t = tagged[i];
      if (t.tag === "stop") break;
      if (t.tag === "header" || t.tag === "barcode") continue;

      // Row number on its own → new item
      if (t.tag === "number" && t.nums && t.nums.length === 1 && t.nums[0] <= 50 && Number.isInteger(t.nums[0])
          && i + 1 < tagged.length && (tagged[i + 1].tag === "product_code" || tagged[i + 1].tag === "product_name")) {
        if (cur && (cur.descParts.length > 0 || cur.nums.length > 0)) items.push(cur);
        cur = { descParts: [], nums: [] };
        continue;
      }

      if (t.tag === "product_code" || t.tag === "product_name") {
        if (cur && cur.nums.length > 0) { items.push(cur); cur = { descParts: [], nums: [] }; }
        if (!cur) cur = { descParts: [], nums: [] };
        if (t.desc) cur.descParts.push(t.desc);
        continue;
      }

      if (t.tag === "number") {
        if (!cur) cur = { descParts: [], nums: [] };
        if (t.nums) cur.nums.push(...t.nums);
        continue;
      }
    }
    if (cur && (cur.descParts.length > 0 || cur.nums.length > 0)) items.push(cur);

    for (const item of items) {
      if (item.descParts.length === 0) continue;
      const description = item.descParts.join(" ");
      const nums = item.nums;
      let qty: number | null = null, unitPrice: number | null = null, total: number | null = null;

      if (hasDiscount && nums.length >= 4) { qty = nums[0]; unitPrice = nums[1]; total = nums[3]; }
      else if (nums.length >= 3) { qty = nums[0]; unitPrice = nums[1]; total = nums[2]; }
      else if (nums.length === 2) { qty = nums[0]; total = nums[1]; }
      else if (nums.length === 1) { total = nums[0]; }

      lineItems.push({ description, quantity: qty, unit_price: unitPrice, total });
    }
  }

  // ── Step 7: Hybrid fallback — merge block items + interleaved trailing items ──
  // Some receipts (CP Extra) start block-style then switch to interleaved.
  // If Step 5 found some items but there are still product lines after the numbers, scan them.
  if (lineItems.length > 0 && lastHeaderTagIdx >= 0) {
    // Find the last number tag that was part of block-style extraction
    const lastUsedNum = lineItems.length * (allNums.length / Math.max(lineItems.length, 1));
    const remainingTags = tagged.filter((_, i) => i > lastHeaderTagIdx);

    // Look for barcode → product → numbers sequences after the block section
    type ItemBlock = { descParts: string[]; nums: number[] };
    let cur: ItemBlock | null = null;
    const extras: ItemBlock[] = [];
    let pastBlockNums = false;
    let numCount = 0;

    for (const t of remainingTags) {
      if (t.tag === "stop") break;
      if (t.tag === "number") { numCount += (t.nums?.length || 0); }
      if (numCount < allNums.length && !pastBlockNums) continue; // still in block section
      pastBlockNums = true;

      if (t.tag === "barcode") {
        if (cur && cur.descParts.length > 0) extras.push(cur);
        cur = { descParts: [], nums: [] };
        continue;
      }
      if ((t.tag === "product_code" || t.tag === "product_name") && t.desc) {
        if (!cur) cur = { descParts: [], nums: [] };
        if (cur.nums.length > 0) { extras.push(cur); cur = { descParts: [], nums: [] }; }
        cur.descParts.push(t.desc);
        continue;
      }
      if (t.tag === "number" && t.nums) {
        if (!cur) cur = { descParts: [], nums: [] };
        cur.nums.push(...t.nums);
        continue;
      }
    }
    if (cur && cur.descParts.length > 0) extras.push(cur);

    for (const item of extras) {
      if (item.descParts.length === 0) continue;
      // Check it's not already in lineItems
      const desc = item.descParts.join(" ");
      if (lineItems.some((li) => li.description === desc)) continue;

      const nums = item.nums;
      let qty: number | null = null, unitPrice: number | null = null, total: number | null = null;

      if (hasDiscount && nums.length >= 4) { qty = nums[0]; unitPrice = nums[1]; total = nums[3]; }
      else if (nums.length >= 3) { qty = nums[0]; unitPrice = nums[1]; total = nums[2]; }
      else if (nums.length === 2) { qty = nums[0]; total = nums[1]; }
      else if (nums.length === 1) { total = nums[0]; }

      lineItems.push({ description: desc, quantity: qty, unit_price: unitPrice, total });
    }
  }

  const toNumber = (value?: string | null) => {
    if (!value) return null;
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toIsoDate = (value?: string | null) => {
    if (!value) return null;
    const text = value.replace(/\//g, "-");
    const parts = text.split("-").map((p) => Number(p));
    if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
    let year = parts[0];
    let month = parts[1];
    let day = parts[2];
    // If date is DD-MM-YYYY, swap order.
    if (parts[0] <= 31 && parts[1] <= 12 && parts[2] >= 1900) {
      day = parts[0];
      month = parts[1];
      year = parts[2];
    }
    // Thai Buddhist Era conversion.
    if (year > 2400) year -= 543;
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  };

  return {
    issuerName: issuerNameMatch ? issuerNameMatch[1].trim() : null,
    issuerTaxId: taxIdMatch ? taxIdMatch[0].replace(/\D/g, "") : null,
    issuerBranchId: branchMatch ? (branchMatch[0].includes("สำนักงานใหญ่") ? "สำนักงานใหญ่" : branchMatch[1].trim()) : null,
    issuerAddress: addressMatch ? addressMatch[1].trim() : null,
    issuerPostalCode: postalMatch ? postalMatch[1] : null,
    invoiceNumber: invoiceNoMatch ? invoiceNoMatch[1] : null,
    invoiceDate: toIsoDate(dateMatch ? dateMatch[1] : null),
    creditDays: creditDaysMatch ? Number(creditDaysMatch[1]) : null,
    dueDate: toIsoDate(dueDateMatch ? dueDateMatch[1] : null),
    subtotal: toNumber(subtotalMatch ? subtotalMatch[1] : null),
    vatAmount: toNumber(vatMatch ? vatMatch[1] : null),
    totalAmount: toNumber(totalMatch ? totalMatch[1] : null),
    customerName: customerNameMatch ? customerNameMatch[1].trim() : null,
    customerAddress: customerAddressMatch ? customerAddressMatch[1].trim() : null,
    customerPostalCode: customerPostalMatch ? customerPostalMatch[1] : null,
    customerBranchId: customerBranchMatch ? (customerBranchMatch[0].includes("สำนักงานใหญ่") ? "สำนักงานใหญ่" : customerBranchMatch[1].trim()) : null,
    isVatIncluded: vatIncludedMatch ? true : vatExcludedMatch ? false : null,
    notes: notesMatch ? notesMatch[1].trim() : null,
    lineItems,
  };
}

export async function extractBillDataGoogleVision(imageBuffer: Buffer, mimeType = "image/jpeg") {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_VISION_API_KEY is missing");
  }

  // Google Vision endpoint for OCR. We use DOCUMENT_TEXT_DETECTION for invoices/receipts.
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBuffer.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["th", "en"] },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Vision OCR failed: HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string };
    }>;
  };
  const first = json.responses?.[0];
  if (first?.error?.message) {
    throw new Error(`Google Vision OCR error: ${first.error.message}`);
  }
  const rawText = first?.fullTextAnnotation?.text || "";
  const extracted = extractFromGoogleVisionText(rawText);

  const mathValidation = validateAmountEquation({
    subtotal: extracted.subtotal,
    vat: extracted.vatAmount,
    grandTotal: extracted.totalAmount,
  });

  // Return the same normalized contract used by Claude path so downstream pipeline remains unchanged.
  return {
    ocr_version: "google-vision-th-v1",
    processing: {
      ocr_tier_used: 1,
      early_terminated: true,
      low_quality: rawText.trim().length < 20,
      needs_rotation_review: false,
    },
    document: {
      document_type: extracted.vatAmount && extracted.vatAmount > 0 ? "TAX_INVOICE" : "OTHER",
      issue_date: extracted.invoiceDate,
      invoice_number: extracted.invoiceNumber,
      credit_days: extracted.creditDays,
      due_date: extracted.dueDate,
    },
    issuer: {
      name: extracted.issuerName,
      tax_id: extracted.issuerTaxId,
      branch_id: extracted.issuerBranchId,
      address: extracted.issuerAddress,
      postal_code: extracted.issuerPostalCode,
    },
    customer: {
      name: extracted.customerName,
      address: extracted.customerAddress,
      postal_code: extracted.customerPostalCode,
      branch_id: extracted.customerBranchId,
    },
    amounts: {
      net_amount_ex_vat: extracted.subtotal,
      vat_amount: extracted.vatAmount,
      total_amount: extracted.totalAmount,
      currency: "THB",
    },
    line_items: extracted.lineItems,
    confidence: {
      overall: rawText.trim().length < 20 ? 0.35 : 0.7,
      weighted: 0.65,
      per_field: {
        issuer_name: extracted.issuerName ? 0.7 : 0.3,
        issuer_tax_id: extracted.issuerTaxId ? 0.75 : 0.3,
        invoice_number: extracted.invoiceNumber ? 0.7 : 0.3,
        invoice_date: extracted.invoiceDate ? 0.7 : 0.3,
        subtotal: extracted.subtotal != null ? 0.65 : 0.3,
        vat_amount: extracted.vatAmount != null ? 0.65 : 0.3,
        total_amount: extracted.totalAmount != null ? 0.65 : 0.3,
      },
    },
    validation: {
      amount_equation: mathValidation,
      raw_text_excerpt: rawText.slice(0, 2000),
    },
    accounting: {
      expense_type: extracted.vatAmount && extracted.vatAmount > 0 ? "VAT_INVOICE" : "NON_VAT_INFORMAL",
      requires_manual_review: true,
      failure_reasons: rawText.trim().length < 20 ? ["LOW_TEXT_SIGNAL"] : [],
      vat_mode: extracted.isVatIncluded === true
        ? "NORMAL_VAT"
        : extracted.vatAmount && extracted.vatAmount > 0
          ? "NORMAL_VAT"
          : "VAT_EXEMPT",
      is_vat_included: extracted.isVatIncluded,
      notes: extracted.notes,
    },
    meta: {
      provider: "google_vision",
      mime_type: mimeType,
    },
  };
}

export async function extractBillData(imageBuffer: Buffer, mimeType = "image/jpeg") {
  // Default to Google Vision; only use Claude if OCR_PROVIDER is explicitly set to "claude"
  if (String(process.env.OCR_PROVIDER || "").toLowerCase() !== "claude") {
    return extractBillDataGoogleVision(imageBuffer, mimeType);
  }

  const base64Image = imageBuffer.toString("base64");
  const [tier1Prompt, tier2Prompt] = await Promise.all([
    readPromptFile("tier1_prompt"),
    readPromptFile("tier2_prompt"),
  ]);

  const requestTierJson = async ({
    promptText,
    maxTokens,
  }: {
    promptText: string;
    maxTokens: number;
  }) => {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: maxTokens,
      system: "You are a precise OCR engine. Return only valid JSON object. Never explain.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as any,
                data: base64Image,
              },
            },
            { type: "text", text: promptText },
          ],
        },
      ],
    });

    const textContent = message.content.find((item) => item.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }
    return parseClaudeJson(textContent.text);
  };

  const tier1Data = await requestTierJson({ promptText: tier1Prompt, maxTokens: 900 });
  if (!isVatCandidate(tier1Data)) {
    return buildResponse({ tier1: tier1Data, earlyTerminated: true });
  }

  const tier2Data = await requestTierJson({ promptText: tier2Prompt, maxTokens: 1400 });
  return buildResponse({ tier1: tier1Data, tier2: tier2Data, earlyTerminated: false });
}

