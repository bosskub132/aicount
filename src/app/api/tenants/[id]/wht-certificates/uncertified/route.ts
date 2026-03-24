import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { listUncertifiedDocuments } from "@/lib/db/queries/wht-certificates";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const url = new URL(request.url);
    const period = url.searchParams.get("period");

    if (!period || !PERIOD_RE.test(period)) {
      return NextResponse.json(
        { success: false, error: "period is required (YYYY-MM format)" },
        { status: 400 },
      );
    }

    const rows = await listUncertifiedDocuments(id, period);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[WHT uncertified GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to list uncertified documents" },
      { status: 500 },
    );
  }
}
