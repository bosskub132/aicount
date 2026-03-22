import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import {
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;

    const [tenant] = await db
      .select({ ownerUserId: tenants.ownerUserId, deletedAt: tenants.deletedAt })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }
    if (tenant.ownerUserId !== ctx.userId) {
      return forbidden("Only workspace owner can cancel deletion");
    }
    if (!tenant.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Workspace is not scheduled for deletion" },
        { status: 400 }
      );
    }

    const now = new Date();

    const [updated] = await db
      .update(tenants)
      .set({
        deletedAt: null,
        deletionScheduledFor: null,
        deletionReason: null,
        updatedAt: now,
      })
      .where(eq(tenants.id, id))
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.deletion_cancelled",
      entityType: "tenant",
      entityId: id,
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Cancel deletion failed" },
      { status: 500 }
    );
  }
}
