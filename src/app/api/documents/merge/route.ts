import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const body = (await request.json()) as {
      tenantId: string;
      documentIds: string[];
    };
    if (!body.tenantId || !Array.isArray(body.documentIds) || body.documentIds.length < 2) {
      return NextResponse.json({ success: false, error: "tenantId, documentIds(>=2) required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.tenantId, body.tenantId), inArray(documents.id, body.documentIds)));

    if (rows.length < 2) {
      return NextResponse.json({ success: false, error: "Need at least 2 documents to merge" }, { status: 400 });
    }

    const base = rows[0];
    const mergedOcrRaw = rows.map((d) => d.ocrRaw).filter(Boolean);

    const [merged] = await db
      .insert(documents)
      .values({
        tenantId: body.tenantId,
        uploadedBy: ctx.userId,
        intakeSource: base.intakeSource,
        fileUrl: base.fileUrl,
        status: "ACTION_REQUIRED",
        ocrRaw: { mergedFrom: body.documentIds, pages: mergedOcrRaw },
      })
      .returning({ id: documents.id, status: documents.status });

    await db
      .update(documents)
      .set({ status: "VOID", voidReason: `Merged into ${merged.id}`, updatedAt: new Date() })
      .where(inArray(documents.id, body.documentIds));

    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    console.error("[documents/merge POST]", error);
    return NextResponse.json(
      { success: false, error: "Merge failed" },
      { status: 500 }
    );
  }
}

