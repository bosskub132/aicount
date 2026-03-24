import { and, between, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { resolvePeriodDates } from "./period-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Pp30Result {
  yearMonth: string;
  outputVat: number;
  inputVat: number;
  netVatPayable: number;
  transactionCount: number;
}

// ── Query ────────────────────────────────────────────────────────────────────

export async function getPp30(
  tenantId: string,
  period: string
): Promise<Pp30Result> {
  const { start, end } = resolvePeriodDates(period, "monthly");

  const rows = await db
    .select({
      direction: documents.direction,
      totalVat: sql<string>`COALESCE(SUM(${documents.vatAmount}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.status, "APPROVED"),
        between(documents.documentDate, start, end),
        sql`${documents.vatAmount} > 0`
      )
    )
    .groupBy(documents.direction);

  let outputVat = 0;
  let inputVat = 0;
  let transactionCount = 0;

  for (const row of rows) {
    const vatTotal = Number(row.totalVat);
    const rowCount = Number(row.count);
    transactionCount += rowCount;

    if (row.direction === "REVENUE") {
      outputVat = vatTotal;
    } else if (row.direction === "EXPENSE") {
      inputVat = vatTotal;
    }
  }

  return {
    yearMonth: period,
    outputVat,
    inputVat,
    netVatPayable: outputVat - inputVat,
    transactionCount,
  };
}
