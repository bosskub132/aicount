import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
  ensureRole,
} from "@/lib/api/request-context";
import { generateCertificate } from "@/lib/services/wht-certificate";

const MAX_BATCH_SIZE = 200;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
    if (!ensureRole(ctx.role, ["admin", "maker"])) {
      return forbidden("Only admin and maker can generate certificates");
    }

    const body = await request.json();
    const { documentIds } = body as { documentIds?: string[] };

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "documentIds must be a non-empty array" },
        { status: 400 },
      );
    }
    if (documentIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_BATCH_SIZE} documents per batch` },
        { status: 400 },
      );
    }

    // TODO T7: For > 10 docs, dispatch Inngest job instead of sync processing
    const generated: Array<{ documentId: string; certificateId: string; certificateNo: string; pdfUrl: string }> = [];
    const skipped: Array<{ documentId: string; reason: string }> = [];
    const errors: Array<{ documentId: string; error: string }> = [];

    for (const docId of documentIds) {
      try {
        const result = await generateCertificate({
          tenantId: id,
          documentId: docId,
          issuedBy: ctx.userId,
        });
        generated.push({ documentId: docId, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.includes("already") || message.includes("not found") || message.includes("WHT amount")) {
          skipped.push({ documentId: docId, reason: message });
        } else {
          errors.push({ documentId: docId, error: message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { generated, skipped, errors },
    });
  } catch (error) {
    console.error("[WHT batch POST]", error);
    return NextResponse.json(
      { success: false, error: "Batch WHT certificate generation failed" },
      { status: 500 },
    );
  }
}
