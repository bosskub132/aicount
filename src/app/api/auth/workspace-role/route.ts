import { NextResponse } from "next/server";
import {
  ensureTenantScope,
  forbidden,
  getRequestContext,
  resolveUserRole,
  unauthorized,
} from "@/lib/api/request-context";

/**
 * Effective role in a tenant (maker / checker / admin from assignments).
 * Used by UI to show Submit vs Approve actions aligned with OCR → maker/checker → Express flow.
 */
export async function GET(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? ctx.tenantId;
  if (!ensureTenantScope(ctx.tenantId, tenantId)) {
    return forbidden("Cross-tenant access denied");
  }

  const role = await resolveUserRole(ctx.userId, tenantId);
  return NextResponse.json({
    success: true,
    data: {
      role,
      canSubmitForApproval: role === "admin" || role === "maker",
      canApproveDocuments: role === "admin" || role === "checker",
    },
  });
}
