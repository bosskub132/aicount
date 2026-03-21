import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenantId: string;
      documentId: string;
      parts: Array<Record<string, unknown>>;
    };

    if (!body.tenantId || !body.documentId || !Array.isArray(body.parts) || body.parts.length < 2) {
      return NextResponse.json({ success: false, error: "tenantId, documentId, parts(>=2) required" }, { status: 400 });
    }

    const [parent] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, body.documentId), eq(documents.tenantId, body.tenantId)))
      .limit(1);

    if (!parent) {
      return NextResponse.json({ success: false, error: "Parent document not found" }, { status: 404 });
    }

    const created = [];
    for (const part of body.parts) {
      const [child] = await db
        .insert(documents)
        .values({
          tenantId: parent.tenantId,
          uploadedBy: parent.uploadedBy,
          intakeSource: parent.intakeSource,
          fileUrl: parent.fileUrl,
          batchId: parent.batchId,
          fileHash: parent.fileHash,
          parentDocumentId: parent.id,
          issuerTaxId: parent.issuerTaxId,
          issuerName: parent.issuerName,
          documentNumber: parent.documentNumber,
          documentDate: parent.documentDate,
          status: "ACTION_REQUIRED",
          ocrRaw: part,
        })
        .returning({ id: documents.id, parentDocumentId: documents.parentDocumentId });
      created.push(child);
    }

    return NextResponse.json({ success: true, data: { parentId: parent.id, created } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Split failed" },
      { status: 500 }
    );
  }
}

