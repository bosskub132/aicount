import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { getPlatformOverview, getDailyCosts } from "@/lib/db/queries/ai-usage";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const [currentOverview, prevOverview, dailyCosts] = await Promise.all([
    getPlatformOverview(year, month),
    getPlatformOverview(prevYear, prevMonth),
    getDailyCosts(year, month),
  ]);

  const costChange =
    prevOverview.totalCostUsd > 0
      ? Math.round(
          ((currentOverview.totalCostUsd - prevOverview.totalCostUsd) /
            prevOverview.totalCostUsd) *
            100
        )
      : null;

  const docChange =
    prevOverview.totalDocuments > 0
      ? Math.round(
          ((currentOverview.totalDocuments - prevOverview.totalDocuments) /
            prevOverview.totalDocuments) *
            100
        )
      : null;

  return NextResponse.json({
    success: true,
    data: {
      overview: {
        current: currentOverview,
        previous: prevOverview,
        costChange,
        docChange,
      },
      dailyCosts,
    },
  });
}
