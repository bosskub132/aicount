import { NextResponse } from "next/server";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { getPp36 } from "@/lib/db/queries/tax-pp36";

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
    const data = await getPp36(id, period);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[tax/pp36] query failed:", err);
    return NextResponse.json({ success: false, error: "Failed to generate PP36 report" }, { status: 500 });
  }
}
