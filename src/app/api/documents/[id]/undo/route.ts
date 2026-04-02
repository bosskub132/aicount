/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    if (!ensureRole(ctx.role, ["admin", "maker", "checker"])) return forbidden("Role not allowed");
    const { id } = await context.params;
    const body = (await request.json()) as { tenantId: string };
    if (!body.tenantId) {
      return NextResponse.json({ success: false, error: "tenantId required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
      .limit(1);
    if (!doc) return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });

    const raw = (doc.ocrRaw as any) || {};
    const history = Array.isArray(raw.undoHistory) ? raw.undoHistory : [];
    if (!history.length) {
      return NextResponse.json({ success: false, error: "No undo history" }, { status: 409 });
    }
    const previous = history.pop();

    const [updated] = await db
      .update(documents)
      .set({
        issuerTaxId: previous.issuerTaxId ?? doc.issuerTaxId,
        issuerName: previous.issuerName ?? doc.issuerName,
        documentNumber: previous.documentNumber ?? doc.documentNumber,
        documentDate: previous.documentDate ?? doc.documentDate,
        subtotal: previous.subtotal ?? doc.subtotal,
        vatAmount: previous.vatAmount ?? doc.vatAmount,
        grandTotal: previous.grandTotal ?? doc.grandTotal,
        status: previous.status ?? doc.status,
        ocrRaw: { ...raw, undoHistory: history },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning({ id: documents.id, status: documents.status });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[documents/:id/undo POST]", error);
    return NextResponse.json(
      { success: false, error: "Undo failed" },
      { status: 500 }
    );
  }
}

