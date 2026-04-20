import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles, tenantAssignments } from "@/lib/db/schema";
import { forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";

const Schema = z.object({
  tenantId: z.string().uuid().nullable(),
});

export async function PATCH(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
  }
  const { tenantId } = parsed.data;

  if (tenantId !== null) {
    const assignments = await db
      .select({ tenantId: tenantAssignments.tenantId })
      .from(tenantAssignments)
      .where(
        and(
          eq(tenantAssignments.userId, ctx.userId),
          eq(tenantAssignments.tenantId, tenantId)
        )
      )
      .limit(1);
    if (assignments.length === 0) {
      return forbidden("Not a member of that workspace");
    }
  }

  await db
    .update(profiles)
    .set({ defaultTenantId: tenantId, updatedAt: new Date() })
    .where(eq(profiles.id, ctx.userId))
    .returning();

  await writeAuditLog({
    tenantId: tenantId ?? ctx.tenantId,
    userId: ctx.userId,
    action: "workspace.default_changed",
    entityType: "profile",
    entityId: ctx.userId,
    metadata: { newDefaultTenantId: tenantId },
    ipAddress: ctx.ipAddress,
  });

  return NextResponse.json({ success: true, data: { tenantId } });
}
