import { and, between, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, vendors } from "@/lib/db/schema";
import { resolvePeriodDates } from "./period-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Pnd53Item {
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
  matchStatus: "matched" | "unmatched";
}

export interface Pnd53Result {
  yearMonth: string;
  items: Pnd53Item[];
  totalWht: number;
  payeeCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toItem(
  row: {
    documentNumber: string | null;
    paymentDate: string | null;
    vendorName: string;
    vendorTaxId: string;
    branch: string;
    vendorAddress: string | null;
    incomeType: string | null;
    amountPaid: string | null;
    whtRate: string | null;
    whtAmount: string | null;
  },
  matchStatus: "matched" | "unmatched"
): Pnd53Item {
  return {
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
    matchStatus,
  };
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * PND53 (ภ.ง.ด.53): WHT report for corporate (company) domestic vendors.
 *
 * Two-pass approach:
 *   Pass 1 — Matched: documents joined to vendors WHERE vendor_type='company'
 *            AND is_non_resident=false.
 *   Pass 2 — Unmatched: documents with WHT but no vendor match (LEFT JOIN
 *            WHERE vendor.id IS NULL). These default to PND53 per spec.
 */
export async function getPnd53(
  tenantId: string,
  period: string
): Promise<Pnd53Result> {
  const { start, end } = resolvePeriodDates(period, "monthly");

  const baseWhere = and(
    eq(documents.tenantId, tenantId),
    eq(documents.status, "APPROVED"),
    eq(documents.direction, "EXPENSE"),
    gt(documents.whtAmount, "0"),
    between(documents.documentDate, start, end),
    isNull(documents.deletedAt)
  );

  const selectFields = {
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
  };

  // Pass 1 — Matched: company vendors, domestic
  const matchedRows = await db
    .select(selectFields)
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
        baseWhere,
        eq(vendors.vendorType, "company"),
        eq(vendors.isNonResident, false)
      )
    )
    .orderBy(documents.documentDate);

  // Pass 2 — Unmatched: no vendor record found
  const unmatchedSelectFields = {
    documentNumber: documents.documentNumber,
    paymentDate: documents.documentDate,
    vendorName: sql<string>`COALESCE(${documents.issuerName}, 'Unknown')`,
    vendorTaxId: sql<string>`COALESCE(${documents.issuerTaxId}, '')`,
    branch: sql<string>`COALESCE(${documents.issuerBranch}, '00000')`,
    vendorAddress: sql<string | null>`NULL`,
    incomeType: documents.whtIncomeType,
    amountPaid: documents.subtotal,
    whtRate: documents.whtRate,
    whtAmount: documents.whtAmount,
  };

  const unmatchedRows = await db
    .select(unmatchedSelectFields)
    .from(documents)
    .leftJoin(
      vendors,
      and(
        eq(vendors.tenantId, documents.tenantId),
        eq(vendors.taxId, documents.issuerTaxId)
      )
    )
    .where(and(baseWhere, isNull(vendors.id)))
    .orderBy(documents.documentDate);

  const matchedItems = matchedRows.map((row) => toItem(row, "matched"));
  const unmatchedItems = unmatchedRows.map((row) => toItem(row, "unmatched"));
  const items = [...matchedItems, ...unmatchedItems];

  const totalWht = items.reduce((sum, item) => sum + item.whtAmount, 0);
  const uniqueTaxIds = new Set(
    items.filter((item) => item.vendorTaxId).map((item) => item.vendorTaxId)
  );

  return {
    yearMonth: period,
    items,
    totalWht,
    payeeCount: uniqueTaxIds.size,
  };
}
