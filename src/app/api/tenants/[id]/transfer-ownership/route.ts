import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenantAssignments, tenants } from "@/lib/db/schema";
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
      .select({ ownerUserId: tenants.ownerUserId })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }
    if (tenant.ownerUserId !== ctx.userId) {
      return forbidden("Only workspace owner can transfer ownership");
    }

    const body = (await request.json()) as { newOwnerId: string };
    if (!body.newOwnerId) {
      return NextResponse.json({ success: false, error: "newOwnerId is required" }, { status: 400 });
    }
    if (body.newOwnerId === ctx.userId) {
      return NextResponse.json(
        { success: false, error: "New owner must be a different user" },
        { status: 400 }
      );
    }

    // Verify the new owner is a member of this workspace
    const [membership] = await db
      .select({ userId: tenantAssignments.userId })
      .from(tenantAssignments)
      .where(
        and(
          eq(tenantAssignments.tenantId, id),
          eq(tenantAssignments.userId, body.newOwnerId)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "New owner must be a member of this workspace" },
        { status: 400 }
      );
    }

    const now = new Date();

    const [updated] = await db
      .update(tenants)
      .set({
        ownerUserId: body.newOwnerId,
        updatedAt: now,
      })
      .where(eq(tenants.id, id))
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.ownership_transferred",
      entityType: "tenant",
      entityId: id,
      metadata: { previousOwnerId: ctx.userId, newOwnerId: body.newOwnerId },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Transfer ownership failed" },
      { status: 500 }
    );
  }
}
