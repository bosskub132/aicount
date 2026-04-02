import { NextResponse } from "next/server";
import { exportApprovedDocumentsToExpress } from "@/lib/services/export-engine";
import { ensureTenantScope, getRequestContext, forbidden, unauthorized } from "@/lib/api/request-context";

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const body = (await request.json()) as {
      tenantId: string;
      period?: "month" | "all";
      journalType?: string;
      returnContent?: boolean;
      exportMode?: "document" | "item";
      selectedDocumentIds?: string[];
      templateId?: string | null;
    };

    if (!body.tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) {
      return forbidden("Cross-tenant access denied");
    }

    const result = await exportApprovedDocumentsToExpress({
      tenantId: body.tenantId,
      period: body.period || "month",
      journalType: body.journalType || "",
      returnContent: Boolean(body.returnContent),
      exportMode: body.exportMode || "document",
      selectedDocumentIds: Array.isArray(body.selectedDocumentIds) ? body.selectedDocumentIds : [],
      templateKey: body.templateId || null,
      exportedByUserId: ctx.userId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[export/express POST]", error);
    const message = error instanceof Error ? error.message : "";
    const isBusinessError =
      message.includes("No APPROVED documents") ||
      message.includes("none could be exported");
    return NextResponse.json(
      { success: false, error: isBusinessError ? "No exportable documents found" : "Export failed" },
      { status: isBusinessError ? 422 : 500 }
    );
  }
}
