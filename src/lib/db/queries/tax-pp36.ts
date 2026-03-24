import { and, between, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, vendors } from "@/lib/db/schema";
import { resolvePeriodDates } from "./period-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Pp36Item {
  documentNumber: string;
  documentDate: string;
  vendorName: string;
  country: string | null;
  description: string;
  amount: number;
  vatAmount: number;
}

export interface Pp36Result {
  yearMonth: string;
  items: Pp36Item[];
  totalAmount: number;
  totalVat: number;
}

// ── Query ────────────────────────────────────────────────────────────────────

export async function getPp36(
  tenantId: string,
  period: string
): Promise<Pp36Result> {
  const { start, end } = resolvePeriodDates(period, "monthly");

  const rows = await db
    .select({
      documentNumber: documents.documentNumber,
      documentDate: documents.documentDate,
      vendorName: sql<string>`COALESCE(${vendors.name}, ${documents.issuerName}, 'Unknown')`,
      country: vendors.country,
      description: sql<string>`COALESCE(${documents.issuerName}, '')`,
      amount: documents.subtotal,
      vatAmount: documents.vatAmount,
    })
    .from(documents)
    .leftJoin(
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
        eq(vendors.isNonResident, true),
        gt(documents.vatAmount, "0"),
        between(documents.documentDate, start, end)
      )
    )
    .orderBy(documents.documentDate);

  const items: Pp36Item[] = rows.map((row) => ({
    documentNumber: row.documentNumber ?? "",
    documentDate: row.documentDate ?? "",
    vendorName: row.vendorName,
    country: row.country ?? null,
    description: row.description,
    amount: Number(row.amount ?? 0),
    vatAmount: Number(row.vatAmount ?? 0),
  }));

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const totalVat = items.reduce((sum, item) => sum + item.vatAmount, 0);

  return {
    yearMonth: period,
    items,
    totalAmount,
    totalVat,
  };
}
