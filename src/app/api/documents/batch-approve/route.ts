import { and, eq, inArray } from "drizzle-orm";
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

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const body = (await request.json()) as {
      tenantId: string;
      approverId: string;
      documentIds: string[];
    };

    if (!body.tenantId || !body.approverId || !Array.isArray(body.documentIds) || !body.documentIds.length) {
      return NextResponse.json({ success: false, error: "tenantId, approverId, documentIds required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const realRole = await resolveUserRole(ctx.userId, body.tenantId);
    if (!ensureRole(realRole, ["admin", "checker"])) {
      return forbidden("Only checker/admin can batch approve");
    }

    const candidates = await db
      .select({ id: documents.id, status: documents.status, documentDate: documents.documentDate })
      .from(documents)
      .where(and(eq(documents.tenantId, body.tenantId), inArray(documents.id, body.documentIds)));

    const pendingDocs = candidates.filter((d) => d.status === "PENDING_APPROVAL");
    const lockChecks = await Promise.all(
      pendingDocs.map(async (d) => ({
        id: d.id,
        locked: await isDocumentMonthLocked(body.tenantId, d.documentDate),
      }))
    );
    let validIds = lockChecks.filter((d) => !d.locked).map((d) => d.id);
    const lockedCount = lockChecks.filter((d) => d.locked).length;

    let skippedSelfSubmit = 0;
    if (realRole === "checker" && validIds.length) {
      const allowed: string[] = [];
      for (const docId of validIds) {
        const submitterId = await getLastAuditUserId(body.tenantId, docId, "document.submitted");
        if (submitterId && submitterId === ctx.userId) {
          skippedSelfSubmit += 1;
          continue;
        }
        allowed.push(docId);
      }
      validIds = allowed;
    }

    if (validIds.length) {
      await db
        .update(documents)
        .set({
          status: "APPROVED",
          approvedBy: body.approverId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(documents.id, validIds));
    }

    await writeAuditLog({
      tenantId: body.tenantId,
      userId: ctx.userId,
      action: "document.batch_approved",
      entityType: "document",
      metadata: {
        requested: body.documentIds.length,
        approved: validIds.length,
        skippedSelfSubmit,
      },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({
      success: true,
      data: {
        requested: body.documentIds.length,
        approved: validIds.length,
        skipped: body.documentIds.length - validIds.length,
        lockedPeriod: lockedCount,
        skippedSelfSubmit,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Batch approve failed" },
      { status: 500 }
    );
  }
}

