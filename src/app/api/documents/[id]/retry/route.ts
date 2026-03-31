import { NextRequest, NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id } = await params;

  let body: { tenantId?: string };
  try {
    body = (await request.json()) as { tenantId?: string };
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!body.tenantId) {
    return NextResponse.json(
      { success: false, error: "tenantId is required" },
      { status: 400 }
    );
  }

  if (!ensureTenantScope(ctx.tenantId, body.tenantId)) {
    return forbidden("Cross-tenant access denied");
  }

  try {
    // Verify document exists and belongs to tenant
    const [doc] = await db
      .select({
        id: documents.id,
        tenantId: documents.tenantId,
        status: documents.status,
      })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!doc || doc.tenantId !== ctx.tenantId) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Update extraction status to processing
    await db
      .update(documents)
      .set({
        extractionStatus: "processing",
        extractionFailureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    // Trigger re-extraction via Inngest
    await inngest.send({
      name: "document/uploaded",
      data: { documentId: id, tenantId: ctx.tenantId, retry: true },
    });

    return NextResponse.json({
      success: true,
      message: "Re-extraction started",
    });
  } catch (error) {
    console.error("Retry extraction failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retry extraction" },
      { status: 500 }
    );
  }
}
