import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenantId: string;
      documentIds: string[];
      uploadedBy: string;
    };
    if (!body.tenantId || !body.uploadedBy || !Array.isArray(body.documentIds) || body.documentIds.length < 2) {
      return NextResponse.json({ success: false, error: "tenantId, uploadedBy, documentIds(>=2) required" }, { status: 400 });
    }

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
        uploadedBy: body.uploadedBy,
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Merge failed" },
      { status: 500 }
    );
  }
}

