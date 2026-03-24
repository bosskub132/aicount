import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { generateReport } from "@/lib/services/report-generator";

const VALID_REPORT_TYPES = [
  "trial_balance",
  "profit_loss",
  "balance_sheet",
  "cash_flow",
  "monthly_comparison",
  "gl_detail",
  "journal_listing",
] as const;

const VALID_SCOPES = ["monthly", "quarterly", "yearly"] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id))
    return forbidden("Cross-tenant access denied");

  let body: {
    reportType?: string;
    period?: string;
    scope?: string;
    filters?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { reportType, period, scope = "monthly", filters } = body;

  // Validate required fields
  if (!reportType || !period) {
    return NextResponse.json(
      { success: false, error: "Missing required fields: reportType, period" },
      { status: 400 }
    );
  }

  // Validate reportType
  if (
    !VALID_REPORT_TYPES.includes(
      reportType as (typeof VALID_REPORT_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid reportType" },
      { status: 400 }
    );
  }

  // Validate scope
  if (!VALID_SCOPES.includes(scope as (typeof VALID_SCOPES)[number])) {
    return NextResponse.json(
      { success: false, error: "Invalid scope. Must be monthly, quarterly, or yearly." },
      { status: 400 }
    );
  }

  // Validate period length to prevent abuse
  if (period.length > 20) {
    return NextResponse.json(
      { success: false, error: "Invalid period format" },
      { status: 400 }
    );
  }

  try {
    const result = await generateReport({
      tenantId: id,
      reportType,
      period,
      scope,
      filters,
      generatedBy: ctx.userId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[POST /reports/generate-pdf]", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report PDF" },
      { status: 500 }
    );
  }
}
