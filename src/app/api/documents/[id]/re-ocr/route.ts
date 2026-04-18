import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { tenantId?: string };
    const tenantId = body.tenantId || ctx.tenantId;

    if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");

    const [doc] = await db
      .select({ id: documents.id, status: documents.status })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    await db
      .update(documents)
      .set({
        status: "OCR_PROCESSING",
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    await inngest.send({
      name: "document/uploaded",
      data: {
        documentId: id,
        tenantId,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id, status: "OCR_PROCESSING" },
    });
  } catch (error) {
    console.error("[documents/re-ocr POST]", error);
    return NextResponse.json(
      { success: false, error: "Re-OCR failed" },
      { status: 500 }
    );
  }
}

