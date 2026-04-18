import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getMonthlyComparison } from "@/lib/db/queries/monthly-comparison";
import { dashboardKeys } from "@/lib/hooks/use-dashboard";
import DashboardClient from "./dashboard-client";

const DEFAULT_MONTHS = 6;

export default async function DashboardPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <DashboardClient />;
  }

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: dashboardKeys.monthlyComparison(tenantId, DEFAULT_MONTHS),
      queryFn: () => getMonthlyComparison(tenantId, DEFAULT_MONTHS),
    });
  } catch (error) {
    console.error("[dashboard prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
