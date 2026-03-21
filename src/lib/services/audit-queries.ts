import { and, desc, eq } from "drizzle-orm";
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
