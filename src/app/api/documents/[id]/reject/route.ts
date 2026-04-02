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
    const body = (await request.json()) as {
      tenantId: string;
      rejectionComment?: string;
    };

    const realRole = await resolveUserRole(ctx.userId, body.tenantId || ctx.tenantId);
    if (!ensureRole(realRole, ["admin", "checker"])) return forbidden("Only checker/admin can reject");

    if (!body.tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
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
        { success: false, error: `Cannot reject status ${doc.status}` },
        { status: 409 }
      );
    }

    const locked = await isDocumentMonthLocked(body.tenantId, doc.documentDate);
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
        rejectionComment: body.rejectionComment || "Rejected by checker",
        ocrRaw: {
          ...docRaw,
          rejectCount: rejectCount + 1,
          rejectionHistory: [
            ...((Array.isArray(docRaw.rejectionHistory) ? docRaw.rejectionHistory : []) as unknown[]),
            {
              rejectedAt: new Date().toISOString(),
              rejectedBy: ctx.userId,
              comment: body.rejectionComment || "Rejected by checker",
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
        tenantId: body.tenantId,
        documentId: id,
        comment: body.rejectionComment || "Rejected by checker",
      },
    });

    await writeAuditLog({
      tenantId: body.tenantId,
      userId: ctx.userId,
      action: "document.rejected",
      entityType: "document",
      entityId: id,
      metadata: { rejectionComment: body.rejectionComment || null },
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

