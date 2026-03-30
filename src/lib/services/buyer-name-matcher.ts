/**
 * Compare OCR-detected buyer name with workspace (tenant) company name.
 * Uses token-based Jaccard similarity after normalizing Thai/English company suffixes.
 */

const THAI_SUFFIXES = ["บริษัท", "จำกัด", "มหาชน", "ห้างหุ้นส่วน", "ห้างหุ้นส่วนจำกัด", "สำนักงานใหญ่"];
const EN_SUFFIXES = ["co.", "co", "ltd.", "ltd", "corp.", "corp", "inc.", "inc", "company", "limited", "public"];

function normalizeCompanyName(name: string): string[] {
  let normalized = name.toLowerCase().trim();
  // Remove Thai suffixes
  for (const suffix of THAI_SUFFIXES) {
    normalized = normalized.replace(new RegExp(suffix, "g"), "");
  }
  // Remove English suffixes
  for (const suffix of EN_SUFFIXES) {
    normalized = normalized.replace(new RegExp(`\\b${suffix}\\.?\\b`, "gi"), "");
  }
  // Remove punctuation, extra whitespace
  normalized = normalized.replace(/[().,\-_]/g, " ").replace(/\s+/g, " ").trim();
  // Tokenize
  return normalized.split(" ").filter(Boolean);
}

export function compareBuyerName(
  ocrBuyerName: string | null | undefined,
  tenantName: string | null | undefined
): { match: boolean; similarity: number } {
  if (!ocrBuyerName || !tenantName) return { match: true, similarity: 1 }; // Can't compare, assume OK

  const tokensA = new Set(normalizeCompanyName(ocrBuyerName));
  const tokensB = new Set(normalizeCompanyName(tenantName));

  if (tokensA.size === 0 || tokensB.size === 0) return { match: true, similarity: 1 };

  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  const similarity = intersection.size / union.size;

  return { match: similarity >= 0.5, similarity };
}
