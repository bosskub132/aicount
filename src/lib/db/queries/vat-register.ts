import { and, between, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, vendors, customers } from "@/lib/db/schema";
import { resolvePeriodDates } from "./period-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VatRegisterItem {
  lineNumber: number;
  documentDate: string;
  documentNumber: string;
  counterpartyName: string;
  counterpartyTaxId: string;
  branch: string;
  amountBeforeVat: number;
  vatAmount: number;
}

export interface VatRegisterResult {
  yearMonth: string;
  direction: string;
  items: VatRegisterItem[];
  totalAmount: number;
  totalVat: number;
  invoiceCount: number;
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * VAT Register (รายงานภาษีซื้อ / รายงานภาษีขาย).
 *
 * - direction='EXPENSE' → Purchase VAT register, joins vendors for fallback
 * - direction='REVENUE' → Sales VAT register, joins customers for fallback
 */
export async function getVatRegister(
  tenantId: string,
  period: string,
  direction: "EXPENSE" | "REVENUE"
): Promise<VatRegisterResult> {
  const { start, end } = resolvePeriodDates(period, "monthly");

  const baseWhere = and(
    eq(documents.tenantId, tenantId),
    eq(documents.status, "APPROVED"),
    eq(documents.direction, direction),
    gt(documents.vatAmount, "0"),
    between(documents.documentDate, start, end)
  );

  let items: VatRegisterItem[];

  if (direction === "EXPENSE") {
    // Purchase VAT register — join vendors
    const rows = await db
      .select({
        documentDate: documents.documentDate,
        documentNumber: documents.documentNumber,
        counterpartyName: sql<string>`COALESCE(${vendors.name}, ${documents.issuerName}, 'Unknown')`,
        counterpartyTaxId: sql<string>`COALESCE(${vendors.taxId}, ${documents.issuerTaxId}, '')`,
        branch: sql<string>`COALESCE(${documents.issuerBranch}, ${vendors.branchNumber}, '00000')`,
        amountBeforeVat: documents.subtotal,
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
      .where(baseWhere)
      .orderBy(documents.documentDate, documents.documentNumber);

    items = rows.map((row, index) => ({
      lineNumber: index + 1,
      documentDate: row.documentDate ?? "",
      documentNumber: row.documentNumber ?? "",
      counterpartyName: row.counterpartyName,
      counterpartyTaxId: row.counterpartyTaxId,
      branch: row.branch,
      amountBeforeVat: Number(row.amountBeforeVat ?? 0),
      vatAmount: Number(row.vatAmount ?? 0),
    }));
  } else {
    // Sales VAT register — join customers
    const rows = await db
      .select({
        documentDate: documents.documentDate,
        documentNumber: documents.documentNumber,
        counterpartyName: sql<string>`COALESCE(${customers.name}, ${documents.issuerName}, 'Unknown')`,
        counterpartyTaxId: sql<string>`COALESCE(${customers.taxId}, ${documents.issuerTaxId}, '')`,
        branch: sql<string>`COALESCE(${documents.issuerBranch}, ${customers.branchNumber}, '00000')`,
        amountBeforeVat: documents.subtotal,
        vatAmount: documents.vatAmount,
      })
      .from(documents)
      .leftJoin(
        customers,
        and(
          eq(customers.tenantId, documents.tenantId),
          eq(customers.taxId, documents.issuerTaxId)
        )
      )
      .where(baseWhere)
      .orderBy(documents.documentDate, documents.documentNumber);

    items = rows.map((row, index) => ({
      lineNumber: index + 1,
      documentDate: row.documentDate ?? "",
      documentNumber: row.documentNumber ?? "",
      counterpartyName: row.counterpartyName,
      counterpartyTaxId: row.counterpartyTaxId,
      branch: row.branch,
      amountBeforeVat: Number(row.amountBeforeVat ?? 0),
      vatAmount: Number(row.vatAmount ?? 0),
    }));
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amountBeforeVat, 0);
  const totalVat = items.reduce((sum, item) => sum + item.vatAmount, 0);

  return {
    yearMonth: period,
    direction,
    items,
    totalAmount,
    totalVat,
    invoiceCount: items.length,
  };
}
