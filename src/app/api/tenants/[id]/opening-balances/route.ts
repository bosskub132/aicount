import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { replaceJournalLines } from "@/lib/db/queries/documents";
import {
  ensureRole,
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { canPostBalanced } from "@/lib/services/tax-gl-mapping";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
    if (!ensureRole(ctx.role, ["admin", "checker"])) return forbidden("Only checker/admin can post opening balances");

    const body = (await request.json()) as {
      uploadedBy: string;
      openingDate: string;
      entries: Array<{ accountCode: string; deptCode?: string; debit: number; credit: number; description?: string }>;
      note?: string;
    };

    if (!body.uploadedBy || !body.openingDate || !Array.isArray(body.entries) || !body.entries.length) {
      return NextResponse.json({ success: false, error: "uploadedBy, openingDate, entries required" }, { status: 400 });
    }
    if (!canPostBalanced(body.entries)) {
      return NextResponse.json({ success: false, error: "Opening balance entries must be balanced" }, { status: 422 });
    }

    const total = body.entries.reduce((sum, row) => sum + Number(row.debit || 0), 0);
    const [doc] = await db
      .insert(documents)
      .values({
        tenantId: id,
        uploadedBy: body.uploadedBy,
        intakeSource: "FRONTEND_UPLOAD",
        status: "APPROVED",
        docType: "OTHER",
        direction: "EXPENSE",
        journalType: "JV",
        issuerName: "OPENING_BALANCE",
        documentNumber: `OB-${body.openingDate}`,
        documentDate: body.openingDate,
        subtotal: String(total.toFixed(2)),
        vatAmount: "0.00",
        grandTotal: String(total.toFixed(2)),
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        ocrRaw: {
          openingBalance: true,
          note: body.note || null,
        },
      })
      .returning({ id: documents.id, documentNumber: documents.documentNumber, status: documents.status });

    await replaceJournalLines(doc.id, body.entries);
    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Create opening balance failed" },
      { status: 500 }
    );
  }
}

