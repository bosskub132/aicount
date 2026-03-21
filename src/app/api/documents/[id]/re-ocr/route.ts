import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { tenantId: string };

    if (!body.tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }

    const [doc] = await db
      .select({ id: documents.id, status: documents.status })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
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
        tenantId: body.tenantId,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id, status: "OCR_PROCESSING" },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Re-OCR failed" },
      { status: 500 }
    );
  }
}

