/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

type Payment = {
  paidAt: string;
  amount: number;
  method?: string;
  note?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    if (!ensureRole(ctx.role, ["admin", "maker", "checker"])) return forbidden("Role not allowed");

    const { id } = await context.params;
    const body = (await request.json()) as { tenantId: string; payment: Payment };
    if (!body.tenantId || !body.payment) {
      return NextResponse.json({ success: false, error: "tenantId and payment required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
      .limit(1);
    if (!doc) return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });

    const raw = (doc.ocrRaw as any) || {};
    const payments = Array.isArray(raw.payments) ? raw.payments : [];
    payments.push(body.payment);
    const paidTotal = payments.reduce((sum: number, p: Payment) => sum + Number(p.amount || 0), 0);
    const grandTotal = Number(doc.grandTotal || 0);
    const paymentStatus =
      paidTotal <= 0 ? "UNPAID" : paidTotal + 0.05 < grandTotal ? "PARTIAL" : "PAID";

    const [updated] = await db
      .update(documents)
      .set({
        ocrRaw: { ...raw, payments, paymentStatus, paidTotal },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning({ id: documents.id, ocrRaw: documents.ocrRaw });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[documents/:id/payments POST]", error);
    return NextResponse.json(
      { success: false, error: "Record payment failed" },
      { status: 500 }
    );
  }
}

