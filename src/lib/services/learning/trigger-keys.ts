import type { PatternType } from "./types";

export function normalizeTriggerKey(
  patternType: PatternType,
  ...parts: (string | null | undefined)[]
): string {
  const filtered = parts.filter(Boolean) as string[];

  switch (patternType) {
    case "coa_mapping": {
      // parts: [vendorTaxId, docType]
      const taxIdPrefix = filtered[0]?.slice(0, 4) ?? "unknown";
      const docType = filtered[1] ?? "unknown";
      return `${taxIdPrefix}:${docType}`;
    }
    case "wht_rate": {
      // parts: [vendorType, incomeCategory]
      const vendorType = filtered[0] ?? "unknown";
      const incomeCategory = filtered[1] ?? "unknown";
      return `${vendorType}:${incomeCategory}`;
    }
    case "smart_default": {
      // parts: [docType, fieldName]
      const docType = filtered[0] ?? "unknown";
      const fieldName = filtered[1] ?? "unknown";
      return `${docType}:${fieldName}`;
    }
    default:
      return filtered.join(":");
  }
}
