import { REPORT_RETENTION_CATEGORY } from "@/lib/utils/constants";
import type { RetentionPolicy } from "@/lib/db/queries/report-retention";

const VALID_UNITS = ["days", "months", "years"] as const;
type RetentionUnit = (typeof VALID_UNITS)[number];

/**
 * Add a duration (days/months/years) to a date, returning a new Date.
 */
export function addDuration(
  date: Date,
  value: number,
  unit: RetentionUnit
): Date {
  const result = new Date(date.getTime());
  switch (unit) {
    case "days":
      result.setDate(result.getDate() + value);
      break;
    case "months":
      result.setMonth(result.getMonth() + value);
      break;
    case "years":
      result.setFullYear(result.getFullYear() + value);
      break;
  }
  return result;
}

/**
 * Compute the expiration date for a report based on its type, lock status, and policy.
 *
 * - Draft (not locked): expires after draftRetentionDays
 * - Locked: uses the retention category mapping to find the correct retention period
 */
export function computeExpiresAt(
  reportType: string,
  isLocked: boolean,
  policy: RetentionPolicy
): Date {
  const now = new Date();

  if (!isLocked) {
    return addDuration(now, policy.draftRetentionDays, "days");
  }

  const category = REPORT_RETENTION_CATEGORY[reportType] ?? "management";

  switch (category) {
    case "financial":
      return addDuration(
        now,
        policy.financialRetentionValue,
        policy.financialRetentionUnit as RetentionUnit
      );
    case "tax":
      return addDuration(
        now,
        policy.taxRetentionValue,
        policy.taxRetentionUnit as RetentionUnit
      );
    case "wht":
      return addDuration(
        now,
        policy.whtRetentionValue,
        policy.whtRetentionUnit as RetentionUnit
      );
    case "management":
    default:
      return addDuration(
        now,
        policy.managementRetentionValue,
        policy.managementRetentionUnit as RetentionUnit
      );
  }
}

/**
 * Validate retention policy input data. Returns an array of error messages (empty = valid).
 */
export function validateRetentionPolicy(data: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (data.draftRetentionDays !== undefined) {
    const v = Number(data.draftRetentionDays);
    if (!Number.isInteger(v) || v < 1 || v > 90) {
      errors.push("draftRetentionDays must be an integer between 1 and 90");
    }
  }

  if (data.trashRecoveryDays !== undefined) {
    const v = Number(data.trashRecoveryDays);
    if (!Number.isInteger(v) || v < 1 || v > 30) {
      errors.push("trashRecoveryDays must be an integer between 1 and 30");
    }
  }

  const retentionFields = [
    { valueKey: "financialRetentionValue", unitKey: "financialRetentionUnit", label: "financial" },
    { valueKey: "taxRetentionValue", unitKey: "taxRetentionUnit", label: "tax" },
    { valueKey: "whtRetentionValue", unitKey: "whtRetentionUnit", label: "wht" },
    { valueKey: "managementRetentionValue", unitKey: "managementRetentionUnit", label: "management" },
  ];

  for (const { valueKey, unitKey, label } of retentionFields) {
    if (data[valueKey] !== undefined) {
      const v = Number(data[valueKey]);
      if (!Number.isInteger(v) || v < 1) {
        errors.push(`${label} retention value must be an integer >= 1`);
      }
    }

    if (data[unitKey] !== undefined) {
      const unit = String(data[unitKey]);
      if (!VALID_UNITS.includes(unit as RetentionUnit)) {
        errors.push(`${label} retention unit must be one of: ${VALID_UNITS.join(", ")}`);
      }

      // Max 99 years check
      if (data[valueKey] !== undefined) {
        const v = Number(data[valueKey]);
        const u = String(data[unitKey]);
        if (Number.isInteger(v) && u === "years" && v > 99) {
          errors.push(`${label} retention cannot exceed 99 years`);
        }
      }
    } else if (data[valueKey] !== undefined) {
      // Value provided without unit — still check max 99 years assuming default "years"
      const v = Number(data[valueKey]);
      if (Number.isInteger(v) && v > 99) {
        errors.push(`${label} retention value cannot exceed 99 when unit is years`);
      }
    }
  }

  return errors;
}
