import { NextResponse } from "next/server";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { getPnd3 } from "@/lib/db/queries/tax-pnd3";

const PERIOD_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const period = new URL(request.url).searchParams.get("period");
  if (!period || !PERIOD_RE.test(period)) {
    return NextResponse.json({ success: false, error: "Invalid or missing period param (YYYY-MM)" }, { status: 400 });
  }

  try {
    const data = await getPnd3(id, period);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[tax/pnd3] query failed:", err);
    return NextResponse.json({ success: false, error: "Failed to generate PND3 report" }, { status: 500 });
  }
}
