import { NextResponse } from "next/server";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { getTrialBalance } from "@/lib/db/queries/trial-balance";

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

  if (!["monthly", "quarterly", "yearly"].includes(scope)) {
    return NextResponse.json(
      { success: false, error: "Invalid scope. Must be monthly, quarterly, or yearly." },
      { status: 400 }
    );
  }

  try {
    const result = await getTrialBalance(id, {
      period,
      scope: scope as "monthly" | "quarterly" | "yearly",
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[reports/trial-balance] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate trial balance" },
      { status: 500 }
    );
  }
}
