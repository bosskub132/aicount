import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { getPerTenantUsage } from "@/lib/db/queries/ai-usage";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const search = searchParams.get("search")?.slice(0, 200) ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  const { rows, total } = await getPerTenantUsage(year, month, search, page, limit);

  return NextResponse.json({
    success: true,
    data: rows,
    meta: { total, page, limit },
  });
}
