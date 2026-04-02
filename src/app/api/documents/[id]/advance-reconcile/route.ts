/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
  ensureRole,
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    if (!ensureRole(ctx.role, ["admin", "maker", "checker"])) return forbidden("Role not allowed");
    const { id } = await context.params;
    const body = (await request.json()) as {
      tenantId: string;
      advanceAmount: number;
      settledAmount: number;
      note?: string;
    };
    if (!body.tenantId) return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
      .limit(1);
    if (!doc) return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });

    const raw = (doc.ocrRaw as any) || {};
    const advanceAmount = Number(body.advanceAmount || 0);
    const settledAmount = Number(body.settledAmount || 0);
    const remaining = Number((advanceAmount - settledAmount).toFixed(2));

    const [updated] = await db
      .update(documents)
      .set({
        ocrRaw: {
          ...raw,
          advanceReconciliation: {
            advanceAmount,
            settledAmount,
            remaining,
            note: body.note || null,
            updatedBy: ctx.userId,
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning({ id: documents.id, ocrRaw: documents.ocrRaw });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[documents/:id/advance-reconcile POST]", error);
    return NextResponse.json(
      { success: false, error: "Advance reconcile failed" },
      { status: 500 }
    );
  }
}

