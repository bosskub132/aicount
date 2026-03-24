import { NextResponse } from "next/server";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { getJournalListing } from "@/lib/db/queries/journal-listing";

const VALID_SCOPES = ["monthly", "quarterly", "yearly"];
const VALID_TYPES = ["manual", "auto", "adjustment"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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
  const type = url.searchParams.get("type") || undefined;
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  if (!period) {
    return NextResponse.json({ success: false, error: "Missing required param: period" }, { status: 400 });
  }
  if (!VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ success: false, error: "Invalid scope. Must be monthly, quarterly, or yearly." }, { status: 400 });
  }
  if (type && !VALID_TYPES.includes(type)) {
    return NextResponse.json({ success: false, error: "Invalid type. Must be manual, auto, or adjustment." }, { status: 400 });
  }

  try {
    const data = await getJournalListing(id, { period, scope, type, page, limit });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[reports/journal-listing] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to generate journal listing report" }, { status: 500 });
  }
}
