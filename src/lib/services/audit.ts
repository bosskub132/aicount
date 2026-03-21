import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export async function writeAuditLog(params: {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId ?? null,
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? null,
    ipAddress: params.ipAddress ?? null,
  });
}

