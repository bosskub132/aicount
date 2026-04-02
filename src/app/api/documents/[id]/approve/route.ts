import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
  ensureRole,
  ensureTenantScope,
  getRequestContext,
  resolveUserRole,
  forbidden,
  unauthorized,
} from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";
import { getLastAuditUserId } from "@/lib/services/audit-queries";
import { isDocumentMonthLocked } from "@/lib/services/period-lock";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { id } = await context.params;
    const body = (await request.json()) as { tenantId: string; approvedBy?: string };
    const approvedBy = body.approvedBy || ctx.userId;

    const realRole = await resolveUserRole(ctx.userId, body.tenantId || ctx.tenantId);
    if (!ensureRole(realRole, ["admin", "checker"])) return forbidden("Only checker/admin can approve");

    if (!body.tenantId) {
      return NextResponse.json(
        { success: false, error: "tenantId is required" },
        { status: 400 }
      );
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    if (doc.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { success: false, error: `Cannot approve status ${doc.status}` },
        { status: 409 }
      );
    }

    const locked = await isDocumentMonthLocked(body.tenantId, doc.documentDate);
    if (locked) {
      return NextResponse.json(
        { success: false, error: "Document period is locked. Cannot approve." },
        { status: 409 }
      );
    }

    if (realRole === "checker") {
      const submitterId = await getLastAuditUserId(body.tenantId, id, "document.submitted");
      if (submitterId && submitterId === ctx.userId) {
        return forbidden(
          "Checker cannot approve a document they submitted. Use another checker or an admin."
        );
      }
    }

    await db
      .update(documents)
      .set({
        status: "APPROVED",
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    await writeAuditLog({
      tenantId: body.tenantId,
      userId: ctx.userId,
      action: "document.approved",
      entityType: "document",
      entityId: id,
      metadata: { approvedBy: body.approvedBy },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({
      success: true,
      data: { id, status: "APPROVED" },
    });
  } catch (error) {
    console.error("[documents/:id/approve POST]", error);
    return NextResponse.json(
      { success: false, error: "Approve failed" },
      { status: 500 }
    );
  }
}

