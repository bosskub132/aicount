const WHT_RULES = [
  { keyword: "ค่าเช่า", rate: 0.05 },
  { keyword: "ค่าบริการ", rate: 0.03 },
  { keyword: "ค่าขนส่ง", rate: 0.01 },
  { keyword: "ค่าโฆษณา", rate: 0.02 },
  { keyword: "ค่าที่ปรึกษา", rate: 0.03 },
  { keyword: "ค่านายหน้า", rate: 0.03 },
  { keyword: "ค่าจ้างทำของ", rate: 0.03 },
  { keyword: "ดอกเบี้ย", rate: 0.01 },
  { keyword: "รางวัล", rate: 0.05 },
  { keyword: "royalty", rate: 0.03 },
  { keyword: "วิชาชีพอิสระ", rate: 0.03 },
  { keyword: "contractor", rate: 0.03 },
];

const normalizeText = (value: unknown) => String(value || "").toLowerCase();

export function detectWht({
  lineItemsText,
  subtotal,
}: {
  lineItemsText: string;
  subtotal: number | string | null;
}): {
  applicable: boolean;
  rate: number;
  amount: number;
  reason: string;
  incomeType: string | null;
} {
  const text = normalizeText(lineItemsText);
  const amount = Number(subtotal || 0);

  if (!Number.isFinite(amount) || amount < 1000) {
    return { applicable: false, rate: 0, amount: 0, reason: "SUBTOTAL_BELOW_THRESHOLD", incomeType: null };
  }

  const matchedRule = WHT_RULES.find((rule) => text.includes(normalizeText(rule.keyword)));
  if (!matchedRule) {
    return { applicable: false, rate: 0, amount: 0, reason: "NO_WHT_KEYWORD_MATCH", incomeType: null };
  }

  const whtAmount = Number((amount * matchedRule.rate).toFixed(2));
  return {
    applicable: true,
    rate: matchedRule.rate,
    amount: whtAmount,
    reason: `MATCHED_${matchedRule.keyword}`,
    incomeType: matchedRule.keyword,
  };
}


