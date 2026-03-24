import { NextResponse } from "next/server";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { getProfitLoss } from "@/lib/db/queries/profit-loss";

const VALID_SCOPES = ["monthly", "quarterly", "yearly"];
const VALID_COMPARISONS = ["prior_month", "prior_year"];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "";
  const scope = url.searchParams.get("scope") || "monthly";
  const department = url.searchParams.get("department") || undefined;
  const comparison = url.searchParams.get("comparison") || undefined;

  if (!period) {
    return NextResponse.json({ success: false, error: "Missing required param: period" }, { status: 400 });
  }
  if (!VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ success: false, error: "Invalid scope. Must be monthly, quarterly, or yearly." }, { status: 400 });
  }
  if (comparison && !VALID_COMPARISONS.includes(comparison)) {
    return NextResponse.json({ success: false, error: "Invalid comparison. Must be prior_month or prior_year." }, { status: 400 });
  }

  try {
    const data = await getProfitLoss(id, { period, scope, department, comparison });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[reports/profit-loss] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to generate profit & loss report" }, { status: 500 });
  }
}
