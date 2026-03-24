import { and, between, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, vendors } from "@/lib/db/schema";
import { resolvePeriodDates } from "./period-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PndItem {
  documentNumber: string;
  paymentDate: string;
  vendorName: string;
  vendorTaxId: string;
  branch: string;
  vendorAddress: string | null;
  incomeType: string | null;
  amountPaid: number;
  whtRate: number;
  whtAmount: number;
}

export interface PndResult {
  yearMonth: string;
  items: PndItem[];
  totalWht: number;
  payeeCount: number;
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * PND3 (ภ.ง.ด.3): WHT report for individual (non-corporate) domestic vendors.
 *
 * Only includes documents matched to a vendor with vendor_type='individual'
 * and is_non_resident=false. Unmatched documents default to PND53 per spec.
 */
export async function getPnd3(
  tenantId: string,
  period: string
): Promise<PndResult> {
  const { start, end } = resolvePeriodDates(period, "monthly");

  const rows = await db
    .select({
      documentNumber: documents.documentNumber,
      paymentDate: documents.documentDate,
      vendorName: sql<string>`COALESCE(${vendors.name}, ${documents.issuerName}, 'Unknown')`,
      vendorTaxId: sql<string>`COALESCE(${vendors.taxId}, ${documents.issuerTaxId}, '')`,
      branch: sql<string>`COALESCE(${documents.issuerBranch}, ${vendors.branchNumber}, '00000')`,
      vendorAddress: vendors.address,
      incomeType: documents.whtIncomeType,
      amountPaid: documents.subtotal,
      whtRate: documents.whtRate,
      whtAmount: documents.whtAmount,
    })
    .from(documents)
    .innerJoin(
      vendors,
      and(
        eq(vendors.tenantId, documents.tenantId),
        eq(vendors.taxId, documents.issuerTaxId)
      )
    )
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.status, "APPROVED"),
        eq(documents.direction, "EXPENSE"),
        gt(documents.whtAmount, "0"),
        eq(vendors.vendorType, "individual"),
        eq(vendors.isNonResident, false),
        between(documents.documentDate, start, end),
        isNull(documents.deletedAt)
      )
    )
    .orderBy(documents.documentDate);

  const items: PndItem[] = rows.map((row) => ({
    documentNumber: row.documentNumber ?? "",
    paymentDate: row.paymentDate ?? "",
    vendorName: row.vendorName,
    vendorTaxId: row.vendorTaxId,
    branch: row.branch,
    vendorAddress: row.vendorAddress ?? null,
    incomeType: row.incomeType ?? null,
    amountPaid: Number(row.amountPaid ?? 0),
    whtRate: Number(row.whtRate ?? 0),
    whtAmount: Number(row.whtAmount ?? 0),
  }));

  const totalWht = items.reduce((sum, item) => sum + item.whtAmount, 0);

  // Count unique payees by tax ID
  const uniqueTaxIds = new Set(items.map((item) => item.vendorTaxId));

  return {
    yearMonth: period,
    items,
    totalWht,
    payeeCount: uniqueTaxIds.size,
  };
}
