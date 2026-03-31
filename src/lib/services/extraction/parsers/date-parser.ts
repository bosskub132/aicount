const THAI_MONTHS: Record<string, string> = {
  "มกราคม": "01",
  "ม.ค.": "01",
  "กุมภาพันธ์": "02",
  "ก.พ.": "02",
  "มีนาคม": "03",
  "มี.ค.": "03",
  "เมษายน": "04",
  "เม.ย.": "04",
  "พฤษภาคม": "05",
  "พ.ค.": "05",
  "มิถุนายน": "06",
  "มิ.ย.": "06",
  "กรกฎาคม": "07",
  "ก.ค.": "07",
  "สิงหาคม": "08",
  "ส.ค.": "08",
  "กันยายน": "09",
  "ก.ย.": "09",
  "ตุลาคม": "10",
  "ต.ค.": "10",
  "พฤศจิกายน": "11",
  "พ.ย.": "11",
  "ธันวาคม": "12",
  "ธ.ค.": "12",
};

/** If year > 2500, it's Buddhist Era — subtract 543 to get CE */
function buddhistToGregorian(year: number): number {
  if (year > 2500) {
    return year - 543;
  }
  return year;
}

/**
 * Resolve a 2-digit year.
 * Thai documents use BE short years (e.g. 67 = 2567 = CE 2024).
 * But if the short year is small enough to be a valid CE year >= 2000,
 * we check: 2500 + yy → CE. If that CE < 2000, treat as CE 20xx instead.
 */
function resolveShortYear(yy: number): number {
  const beYear = 2500 + yy;
  const ceFromBe = beYear - 543;
  if (ceFromBe >= 2000) {
    return ceFromBe;
  }
  // Fallback: treat as CE 20xx
  return 2000 + yy;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function validateAndFormat(year: number, month: number, day: number): string | null {
  if (year < 2000) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseThaiDate(input: string): string | null {
  if (input == null || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (trimmed === "") return null;

  // Strip time component (T or space followed by HH:MM)
  const withoutTime = trimmed.replace(/[T ]\d{2}:\d{2}(:\d{2})?.*$/, "");

  // Pattern 1: ISO format YYYY-MM-DD (could be CE or BE)
  const isoMatch = withoutTime.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const rawYear = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const year = buddhistToGregorian(rawYear);
    return validateAndFormat(year, month, day);
  }

  // Pattern 2: DD/MM/YYYY or DD-MM-YYYY (BE or CE full year)
  const dmyFullMatch = withoutTime.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (dmyFullMatch) {
    const day = parseInt(dmyFullMatch[1], 10);
    const month = parseInt(dmyFullMatch[2], 10);
    const rawYear = parseInt(dmyFullMatch[3], 10);
    const year = buddhistToGregorian(rawYear);
    return validateAndFormat(year, month, day);
  }

  // Pattern 3: D/M/YY (short year, BE convention)
  const dmyShortMatch = withoutTime.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/);
  if (dmyShortMatch) {
    const day = parseInt(dmyShortMatch[1], 10);
    const month = parseInt(dmyShortMatch[2], 10);
    const yy = parseInt(dmyShortMatch[3], 10);
    const year = resolveShortYear(yy);
    return validateAndFormat(year, month, day);
  }

  // Pattern 4: Thai month names — "D monthName YYYY" or "D monthName YY"
  // Sort keys by length descending so abbreviated forms with dots match before substrings
  const sortedMonthKeys = Object.keys(THAI_MONTHS).sort((a, b) => b.length - a.length);
  for (const monthName of sortedMonthKeys) {
    const escapedName = monthName.replace(/\./g, "\\.");
    const thaiMatch = withoutTime.match(
      new RegExp(`^(\\d{1,2})\\s+${escapedName}\\s+(\\d{2,4})$`)
    );
    if (thaiMatch) {
      const day = parseInt(thaiMatch[1], 10);
      const month = parseInt(THAI_MONTHS[monthName], 10);
      const rawYearStr = thaiMatch[2];
      let year: number;
      if (rawYearStr.length <= 2) {
        year = resolveShortYear(parseInt(rawYearStr, 10));
      } else {
        year = buddhistToGregorian(parseInt(rawYearStr, 10));
      }
      return validateAndFormat(year, month, day);
    }
  }

  return null;
}
