import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
  ensureRole,
} from "@/lib/api/request-context";
import { getCertificate } from "@/lib/db/queries/wht-certificates";
import { voidCertificate } from "@/lib/services/wht-certificate";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; certId: string }> },
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id, certId } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const cert = await getCertificate(id, certId);
    if (!cert) {
      return NextResponse.json(
        { success: false, error: "Certificate not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: cert });
  } catch (error) {
    console.error("[WHT certificate GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch certificate" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; certId: string }> },
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id, certId } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
    if (!ensureRole(ctx.role, ["admin", "checker"])) {
      return forbidden("Only admin and checker can void certificates");
    }

    const body = await request.json();
    const { action, reason } = body as { action?: string; reason?: string };

    if (action !== "void") {
      return NextResponse.json(
        { success: false, error: "Only 'void' action is supported" },
        { status: 400 },
      );
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "reason is required for voiding" },
        { status: 400 },
      );
    }

    await voidCertificate(id, certId, reason.trim(), ctx.userId);

    return NextResponse.json({ success: true, data: { id: certId, status: "voided" } });
  } catch (error) {
    console.error("[WHT certificate PATCH]", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not found")) {
      return NextResponse.json({ success: false, error: "Certificate not found" }, { status: 404 });
    }
    if (message.includes("already voided")) {
      return NextResponse.json({ success: false, error: "Certificate is already voided" }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to void certificate" },
      { status: 500 },
    );
  }
}
