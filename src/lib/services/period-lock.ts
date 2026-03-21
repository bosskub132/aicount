import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { periodLocks } from "@/lib/db/schema";

function toYearMonth(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 7);
}

export async function isDocumentMonthLocked(tenantId: string, documentDate: string | Date | null | undefined) {
  const yearMonth = toYearMonth(documentDate);
  if (!yearMonth) return false;
  const [row] = await db
    .select({ id: periodLocks.id })
    .from(periodLocks)
    .where(and(eq(periodLocks.tenantId, tenantId), eq(periodLocks.yearMonth, yearMonth)))
    .limit(1);
  return Boolean(row);
}

