import { NextResponse } from "next/server";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { getAccountLedger } from "@/lib/db/queries/account-ledger";
import { resolvePeriodDates } from "@/lib/db/queries/period-utils";

const VALID_SCOPES = ["monthly", "quarterly", "yearly"];
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
  const account = url.searchParams.get("account") || "";
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  if (!period) {
    return NextResponse.json({ success: false, error: "Missing required param: period" }, { status: 400 });
  }
  if (!account) {
    return NextResponse.json({ success: false, error: "Missing required param: account" }, { status: 400 });
  }
  if (!VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ success: false, error: "Invalid scope. Must be monthly, quarterly, or yearly." }, { status: 400 });
  }

  try {
    const dates = resolvePeriodDates(period, scope);
    const result = await getAccountLedger(db, id, account, dates.start, dates.end);

    // Paginate transactions
    const total = result.transactions.length;
    const offset = (page - 1) * limit;
    const paginatedTransactions = result.transactions.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        accountCode: account,
        period: dates,
        openingBalance: result.openingBalance,
        closingBalance: result.closingBalance,
        periodDebits: result.periodDebits,
        periodCredits: result.periodCredits,
        netMovement: result.netMovement,
        transactions: paginatedTransactions,
        pagination: { page, limit, total },
      },
    });
  } catch (err) {
    console.error("[reports/gl-detail] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to generate GL detail report" }, { status: 500 });
  }
}
