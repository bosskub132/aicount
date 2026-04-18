import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import {
  ensureRole,
  ensureTenantScope,
  getRequestContext,
  resolveUserRole,
  forbidden,
  unauthorized,
} from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";
import { isDocumentMonthLocked } from "@/lib/services/period-lock";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      tenantId?: string;
      rejectionComment?: string;
      comment?: string;
    };
    const tenantId = body.tenantId || ctx.tenantId;
    const rejectionComment = body.rejectionComment ?? body.comment;

    const realRole = await resolveUserRole(ctx.userId, tenantId);
    if (!ensureRole(realRole, ["admin", "checker"])) return forbidden("Only checker/admin can reject");

    if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    if (doc.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { success: false, error: `Cannot reject status ${doc.status}` },
        { status: 409 }
      );
    }

    const locked = await isDocumentMonthLocked(tenantId, doc.documentDate);
    if (locked) {
      return NextResponse.json(
        { success: false, error: "Document period is locked. Cannot reject." },
        { status: 409 }
      );
    }

    const docRaw = (doc.ocrRaw as Record<string, unknown> | null) || {};
    const rejectCount = Number((docRaw.rejectCount as number | undefined) || 0);
    if (rejectCount >= 3) {
      return NextResponse.json(
        { success: false, error: "Rejection loop limit reached. Escalate to admin." },
        { status: 409 }
      );
    }

    await db
      .update(documents)
      .set({
        status: "REJECTED",
        rejectionComment: rejectionComment || "Rejected by checker",
        ocrRaw: {
          ...docRaw,
          rejectCount: rejectCount + 1,
          rejectionHistory: [
            ...((Array.isArray(docRaw.rejectionHistory) ? docRaw.rejectionHistory : []) as unknown[]),
            {
              rejectedAt: new Date().toISOString(),
              rejectedBy: ctx.userId,
              comment: rejectionComment || "Rejected by checker",
            },
          ],
        },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    await inngest.send({
      name: "document/rejected",
      data: {
        userId: doc.uploadedBy,
        tenantId: tenantId,
        documentId: id,
        comment: rejectionComment || "Rejected by checker",
      },
    });

    await writeAuditLog({
      tenantId: tenantId,
      userId: ctx.userId,
      action: "document.rejected",
      entityType: "document",
      entityId: id,
      metadata: { rejectionComment: rejectionComment || null },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({
      success: true,
      data: { id, status: "REJECTED" },
    });
  } catch (error) {
    console.error("[documents/:id/reject POST]", error);
    return NextResponse.json(
      { success: false, error: "Reject failed" },
      { status: 500 }
    );
  }
}

