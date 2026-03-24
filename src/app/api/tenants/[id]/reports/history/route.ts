import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { listReportHistory } from "@/lib/db/queries/report-history";

const VALID_REPORT_TYPES = [
  "trial_balance",
  "profit_loss",
  "balance_sheet",
  "cash_flow",
  "monthly_comparison",
  "gl_detail",
  "journal_listing",
] as const;

const VALID_STATUSES = ["locked", "draft", "trash", "all"] as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id))
    return forbidden("Cross-tenant access denied");

  const url = new URL(request.url);
  const reportType = url.searchParams.get("reportType") ?? undefined;
  const status = url.searchParams.get("status") ?? "all";
  const pageParam = url.searchParams.get("page");
  const limitParam = url.searchParams.get("limit");

  // Validate reportType
  if (
    reportType &&
    !VALID_REPORT_TYPES.includes(reportType as (typeof VALID_REPORT_TYPES)[number])
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid reportType" },
      { status: 400 }
    );
  }

  // Validate status
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { success: false, error: "Invalid status filter" },
      { status: 400 }
    );
  }

  const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  const limit = limitParam
    ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20))
    : 20;

  try {
    const result = await listReportHistory(id, {
      reportType,
      status: status as "locked" | "draft" | "trash" | "all",
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: { rows: result.rows, total: result.total, page, limit },
    });
  } catch (error) {
    console.error("[GET /reports/history]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch report history" },
      { status: 500 }
    );
  }
}
