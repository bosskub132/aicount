import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

/** Latest actor for an entity action (e.g. document.submitted). */
export async function getLastAuditUserId(
  tenantId: string,
  entityId: string,
  action: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: auditLogs.userId })
    .from(auditLogs)
    .where(
      and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.entityId, entityId), eq(auditLogs.action, action))
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  return row?.userId ?? null;
}

/** Batch: latest actor for each entity in a set (single query). */
export async function getLastAuditUserIdBatch(
  tenantId: string,
  entityIds: string[],
  action: string
): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map();

  const rows = await db
    .select({
      entityId: auditLogs.entityId,
      userId: auditLogs.userId,
      rn: sql<number>`row_number() over (partition by ${auditLogs.entityId} order by ${auditLogs.createdAt} desc)`.as("rn"),
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        inArray(auditLogs.entityId, entityIds as string[]),
        eq(auditLogs.action, action)
      )
    );

  const result = new Map<string, string>();
  for (const row of rows) {
    if (row.rn === 1 && row.entityId && row.userId) {
      result.set(row.entityId, row.userId);
    }
  }
  return result;
}
