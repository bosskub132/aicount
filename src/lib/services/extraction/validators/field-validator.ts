const VALID_CURRENCIES = new Set([
  "THB", "USD", "EUR", "GBP", "JPY", "CNY", "SGD", "HKD",
  "KRW", "AUD", "MYR", "IDR", "PHP", "VND", "TWD", "INR",
  "CHF", "CAD", "NZD",
]);

const DATE_FIELDS = new Set(["issue_date", "due_date", "credit_due_date"]);

const AMOUNT_FIELDS = new Set([
  "amount", "vat_amount", "total_amount", "net_amount_ex_vat", "discount_amount",
]);

function validateTaxId(value: unknown): { isValid: boolean; reason?: string } {
  if (typeof value !== "string") {
    return { isValid: false, reason: "tax_id must be a string" };
  }
  if (value.length !== 13) {
    return { isValid: false, reason: "tax_id must be exactly 13 digits" };
  }
  if (!/^\d{13}$/.test(value)) {
    return { isValid: false, reason: "tax_id must contain only digits" };
  }
  return { isValid: true };
}

function validateDate(value: unknown): { isValid: boolean; reason?: string } {
  if (typeof value !== "string") {
    return { isValid: false, reason: "date must be a string" };
  }
  const match = value.match(/^(\d{4})-/);
  if (!match) {
    return { isValid: false, reason: "date must be in YYYY-MM-DD format" };
  }
  const year = parseInt(match[1], 10);
  if (year < 2000 || year > 2030) {
    return { isValid: false, reason: `year ${year} is outside valid range 2000-2030` };
  }
  return { isValid: true };
}

function validateCurrency(value: unknown): { isValid: boolean; reason?: string } {
  if (typeof value !== "string") {
    return { isValid: false, reason: "currency must be a string" };
  }
  if (!VALID_CURRENCIES.has(value)) {
    return { isValid: false, reason: `unknown currency code: ${value}` };
  }
  return { isValid: true };
}

function validateAmount(value: unknown): { isValid: boolean; reason?: string } {
  if (typeof value !== "number") {
    return { isValid: false, reason: "amount must be a number" };
  }
  if (!Number.isFinite(value)) {
    return { isValid: false, reason: "amount must be finite" };
  }
  if (value < 0) {
    return { isValid: false, reason: "amount must be non-negative" };
  }
  return { isValid: true };
}

export function validateFields(
  fields: Record<string, unknown>
): Record<string, { isValid: boolean; reason?: string }> {
  const results: Record<string, { isValid: boolean; reason?: string }> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) {
      results[key] = { isValid: true };
      continue;
    }

    if (key === "tax_id") {
      results[key] = validateTaxId(value);
    } else if (DATE_FIELDS.has(key)) {
      results[key] = validateDate(value);
    } else if (key === "currency") {
      results[key] = validateCurrency(value);
    } else if (AMOUNT_FIELDS.has(key)) {
      results[key] = validateAmount(value);
    } else {
      results[key] = { isValid: true };
    }
  }

  return results;
}
