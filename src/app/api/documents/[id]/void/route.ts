import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
  ensureRole,
  ensureTenantScope,
  getRequestContext,
  forbidden,
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
    if (!ensureRole(ctx.role, ["admin", "checker"])) return forbidden("Only checker/admin can void");

    const { id } = await context.params;
    const body = (await request.json()) as { tenantId: string; reason?: string };

    if (!body.tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
      .limit(1);
    if (!doc) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(documents)
      .set({
        status: "VOID",
        voidReason: body.reason || "Voided by user",
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning({ id: documents.id, status: documents.status, voidReason: documents.voidReason });

    await writeAuditLog({
      tenantId: body.tenantId,
      userId: ctx.userId,
      action: "document.voided",
      entityType: "document",
      entityId: id,
      metadata: { reason: body.reason || null },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[documents/:id/void POST]", error);
    return NextResponse.json(
      { success: false, error: "Void failed" },
      { status: 500 }
    );
  }
}

