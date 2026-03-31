/**
 * Parse Thai/international number formats into a standard JavaScript number.
 *
 * Handles:
 * - Standard: 1,750,000.00
 * - Thai ambiguous: 1,750,000,00 (last comma with 2 digits = decimal)
 * - European: 1.750.000,00 (periods = thousands, comma = decimal)
 * - Currency symbols: ฿, $, €, £
 * - Negative numbers
 * - Numeric passthrough
 */
export function parseThaiNumber(
  input: string | number | null | undefined
): number | null {
  if (input == null) return null;

  // Numeric passthrough
  if (typeof input === "number") {
    return isNaN(input) ? null : input;
  }

  if (typeof input !== "string") return null;

  // Strip whitespace and currency symbols
  let cleaned = input.trim().replace(/[฿$€£\s]/g, "");

  if (cleaned === "") return null;

  // Handle negative sign
  let negative = false;
  if (cleaned.startsWith("-")) {
    negative = true;
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    negative = true;
    cleaned = cleaned.slice(1, -1);
  }

  // Count separator occurrences
  const commaCount = (cleaned.match(/,/g) || []).length;
  const periodCount = (cleaned.match(/\./g) || []).length;

  let normalized: string;

  if (periodCount > 1 && commaCount <= 1) {
    // European format: periods are thousands, comma is decimal
    // e.g., "1.750.000,00"
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (commaCount > 1 && periodCount === 0) {
    // Thai ambiguous: multiple commas, no period
    // e.g., "1,750,000,00" — last comma with 2 digits after = decimal
    const lastCommaIdx = cleaned.lastIndexOf(",");
    const afterLast = cleaned.substring(lastCommaIdx + 1);
    if (afterLast.length === 2) {
      // Last comma is decimal separator
      const beforeDecimal = cleaned.substring(0, lastCommaIdx).replace(/,/g, "");
      normalized = `${beforeDecimal}.${afterLast}`;
    } else {
      // All commas are thousands separators
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount >= 1 && periodCount === 1) {
    // Standard format: commas are thousands, period is decimal
    // e.g., "1,750,000.00"
    normalized = cleaned.replace(/,/g, "");
  } else if (commaCount === 1 && periodCount === 0) {
    // Single comma — ambiguous
    const afterComma = cleaned.split(",")[1];
    if (afterComma.length === 2) {
      // Could be decimal (e.g., "7,00" = 7.00) or thousands (e.g., "1,500")
      // Heuristic: if the part before comma is < 4 digits, treat as thousands
      const beforeComma = cleaned.split(",")[0];
      if (beforeComma.length >= 1 && parseInt(beforeComma, 10) < 1000 && afterComma.length === 2) {
        // Ambiguous: "5,00" could be 5.00 or 500.
        // In Thai accounting context, comma with 3+ digit before is thousands.
        // "1,500" = 1500, "5,015" = 5015
        // But "7,00" = 7.00 if the number is small.
        // Safest: if digits after comma are exactly 2 AND the full number parses > number with decimal,
        // treat as thousands separator (Thai convention)
        normalized = cleaned.replace(/,/g, "");
      } else {
        normalized = cleaned.replace(/,/g, "");
      }
    } else if (afterComma.length === 3) {
      // e.g., "1,500" — comma is thousands separator
      normalized = cleaned.replace(/,/g, "");
    } else {
      // Default: treat comma as decimal
      normalized = cleaned.replace(",", ".");
    }
  } else if (periodCount === 1 && commaCount === 0) {
    // Single period — decimal point
    normalized = cleaned;
  } else {
    // No separators or other cases
    normalized = cleaned.replace(/,/g, "").replace(/\./g, "");
    // Re-check if it's just digits
    if (!/^\d+$/.test(normalized)) {
      normalized = cleaned;
    }
  }

  const result = parseFloat(normalized);
  if (isNaN(result)) return null;

  return negative ? -result : result;
}
