import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import {
  getPayablesAging,
  getPayablesStats,
} from "@/lib/db/queries/payables";

const querySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().max(100).optional(),
  status: z
    .enum(["all", "open", "overdue", "partial", "paid"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId))
    return forbidden("Cross-tenant access denied");

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid query parameters" },
      { status: 400 },
    );
  }

  const { status: rawStatus, ...rest } = parsed.data;
  const statusFilter = rawStatus === "all" ? undefined : rawStatus;

  try {
    const [agingResult, stats] = await Promise.all([
      getPayablesAging(db, tenantId, { ...rest, status: statusFilter }),
      getPayablesStats(db, tenantId),
    ]);

    return NextResponse.json({
      success: true,
      vendors: agingResult.vendors,
      totals: agingResult.totals,
      stats,
      page: agingResult.page,
      pageSize: agingResult.pageSize,
      totalVendors: agingResult.totalVendors,
    });
  } catch (error) {
    console.error("GET /api/tenants/[id]/payables failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payables" },
      { status: 500 },
    );
  }
}
