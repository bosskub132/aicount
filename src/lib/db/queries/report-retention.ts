import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reportRetentionPolicy } from "@/lib/db/schema";

const DEFAULTS = {
  draftRetentionDays: 30,
  trashRecoveryDays: 7,
  financialRetentionValue: 7,
  financialRetentionUnit: "years",
  taxRetentionValue: 7,
  taxRetentionUnit: "years",
  whtRetentionValue: 7,
  whtRetentionUnit: "years",
  managementRetentionValue: 2,
  managementRetentionUnit: "years",
} as const;

export type RetentionPolicy = typeof DEFAULTS & {
  id: string | null;
  tenantId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
};

export async function getRetentionPolicy(
  tenantId: string
): Promise<RetentionPolicy> {
  const [row] = await db
    .select()
    .from(reportRetentionPolicy)
    .where(eq(reportRetentionPolicy.tenantId, tenantId))
    .limit(1);

  if (row) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      draftRetentionDays: row.draftRetentionDays,
      trashRecoveryDays: row.trashRecoveryDays,
      financialRetentionValue: row.financialRetentionValue,
      financialRetentionUnit: row.financialRetentionUnit,
      taxRetentionValue: row.taxRetentionValue,
      taxRetentionUnit: row.taxRetentionUnit,
      whtRetentionValue: row.whtRetentionValue,
      whtRetentionUnit: row.whtRetentionUnit,
      managementRetentionValue: row.managementRetentionValue,
      managementRetentionUnit: row.managementRetentionUnit,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }

  return {
    id: null,
    tenantId,
    ...DEFAULTS,
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
  };
}

export async function upsertRetentionPolicy(
  tenantId: string,
  data: {
    draftRetentionDays?: number;
    trashRecoveryDays?: number;
    financialRetentionValue?: number;
    financialRetentionUnit?: string;
    taxRetentionValue?: number;
    taxRetentionUnit?: string;
    whtRetentionValue?: number;
    whtRetentionUnit?: string;
    managementRetentionValue?: number;
    managementRetentionUnit?: string;
  },
  updatedBy: string
): Promise<RetentionPolicy> {
  const now = new Date();

  const [row] = await db
    .insert(reportRetentionPolicy)
    .values({
      tenantId,
      draftRetentionDays: data.draftRetentionDays ?? DEFAULTS.draftRetentionDays,
      trashRecoveryDays: data.trashRecoveryDays ?? DEFAULTS.trashRecoveryDays,
      financialRetentionValue: data.financialRetentionValue ?? DEFAULTS.financialRetentionValue,
      financialRetentionUnit: data.financialRetentionUnit ?? DEFAULTS.financialRetentionUnit,
      taxRetentionValue: data.taxRetentionValue ?? DEFAULTS.taxRetentionValue,
      taxRetentionUnit: data.taxRetentionUnit ?? DEFAULTS.taxRetentionUnit,
      whtRetentionValue: data.whtRetentionValue ?? DEFAULTS.whtRetentionValue,
      whtRetentionUnit: data.whtRetentionUnit ?? DEFAULTS.whtRetentionUnit,
      managementRetentionValue: data.managementRetentionValue ?? DEFAULTS.managementRetentionValue,
      managementRetentionUnit: data.managementRetentionUnit ?? DEFAULTS.managementRetentionUnit,
      updatedBy,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: reportRetentionPolicy.tenantId,
      set: {
        ...(data.draftRetentionDays !== undefined && { draftRetentionDays: data.draftRetentionDays }),
        ...(data.trashRecoveryDays !== undefined && { trashRecoveryDays: data.trashRecoveryDays }),
        ...(data.financialRetentionValue !== undefined && { financialRetentionValue: data.financialRetentionValue }),
        ...(data.financialRetentionUnit !== undefined && { financialRetentionUnit: data.financialRetentionUnit }),
        ...(data.taxRetentionValue !== undefined && { taxRetentionValue: data.taxRetentionValue }),
        ...(data.taxRetentionUnit !== undefined && { taxRetentionUnit: data.taxRetentionUnit }),
        ...(data.whtRetentionValue !== undefined && { whtRetentionValue: data.whtRetentionValue }),
        ...(data.whtRetentionUnit !== undefined && { whtRetentionUnit: data.whtRetentionUnit }),
        ...(data.managementRetentionValue !== undefined && { managementRetentionValue: data.managementRetentionValue }),
        ...(data.managementRetentionUnit !== undefined && { managementRetentionUnit: data.managementRetentionUnit }),
        updatedBy,
        updatedAt: now,
      },
    })
    .returning();

  return {
    id: row.id,
    tenantId: row.tenantId,
    draftRetentionDays: row.draftRetentionDays,
    trashRecoveryDays: row.trashRecoveryDays,
    financialRetentionValue: row.financialRetentionValue,
    financialRetentionUnit: row.financialRetentionUnit,
    taxRetentionValue: row.taxRetentionValue,
    taxRetentionUnit: row.taxRetentionUnit,
    whtRetentionValue: row.whtRetentionValue,
    whtRetentionUnit: row.whtRetentionUnit,
    managementRetentionValue: row.managementRetentionValue,
    managementRetentionUnit: row.managementRetentionUnit,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}
