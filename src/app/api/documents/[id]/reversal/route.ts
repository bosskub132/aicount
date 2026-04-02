import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, journalLines } from "@/lib/db/schema";
import { replaceJournalLines } from "@/lib/db/queries/documents";
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
      uploadedBy: string;
      reason?: string;
    };
    const realRole = await resolveUserRole(ctx.userId, body.tenantId || ctx.tenantId);
    if (!ensureRole(realRole, ["admin", "checker"])) {
      return forbidden("Only checker/admin can create reversal");
    }
    if (!body.tenantId || !body.uploadedBy) {
      return NextResponse.json(
        { success: false, error: "tenantId and uploadedBy are required" },
        { status: 400 }
      );
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
      .limit(1);
    if (!doc) return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    if (doc.status !== "EXPORTED" && doc.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: `Reversal is allowed only for APPROVED/EXPORTED documents (current: ${doc.status})` },
        { status: 409 }
      );
    }

    const locked = await isDocumentMonthLocked(body.tenantId, doc.documentDate);
    if (locked) {
      return NextResponse.json(
        { success: false, error: "Document period is locked. Cannot create reversal." },
        { status: 409 }
      );
    }

    const lines = await db.select().from(journalLines).where(eq(journalLines.documentId, id));
    if (!lines.length) {
      return NextResponse.json({ success: false, error: "No journal lines to reverse" }, { status: 422 });
    }

    const [reversalDoc] = await db
      .insert(documents)
      .values({
        tenantId: body.tenantId,
        uploadedBy: body.uploadedBy,
        intakeSource: "FRONTEND_UPLOAD",
        fileUrl: doc.fileUrl,
        fileHash: doc.fileHash,
        reversesDocumentId: doc.id,
        issuerTaxId: doc.issuerTaxId,
        issuerName: doc.issuerName,
        documentNumber: `${doc.documentNumber || doc.id}-REV`,
        documentDate: new Date().toISOString().slice(0, 10),
        subtotal: doc.subtotal,
        vatAmount: doc.vatAmount,
        grandTotal: doc.grandTotal,
        whtAmount: doc.whtAmount,
        direction: doc.direction,
        docType: "OTHER",
        status: "PENDING_APPROVAL",
        journalType: "JV",
        confidenceScore: doc.confidenceScore,
        ocrRaw: {
          reversalOf: doc.id,
          reason: body.reason || "Correction/Reversal",
          createdBy: ctx.userId,
          createdAt: new Date().toISOString(),
        },
      })
      .returning({ id: documents.id, status: documents.status, documentNumber: documents.documentNumber });

    await replaceJournalLines(
      reversalDoc.id,
      lines.map((line) => ({
        accountCode: line.accountCode,
        deptCode: line.deptCode,
        debit: Number(line.credit || 0),
        credit: Number(line.debit || 0),
        description: `Reversal: ${line.description || ""}`.trim(),
      }))
    );

    await writeAuditLog({
      tenantId: body.tenantId,
      userId: ctx.userId,
      action: "document.reversal.created",
      entityType: "document",
      entityId: reversalDoc.id,
      metadata: { originalDocumentId: doc.id, reason: body.reason || null },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: reversalDoc }, { status: 201 });
  } catch (error) {
    console.error("[documents/:id/reversal POST]", error);
    return NextResponse.json(
      { success: false, error: "Create reversal failed" },
      { status: 500 }
    );
  }
}

