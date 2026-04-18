import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getProfitLoss } from "@/lib/db/queries/profit-loss";
import { profitLossKeys } from "@/lib/hooks/use-profit-loss";
import ProfitLossClient from "./profit-loss-client";

export default async function ProfitLossPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <ProfitLossClient />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const clientParams = {
    period,
    scope: "monthly",
    department: undefined,
    comparison: undefined,
  };

  const queryClient = new QueryClient();
  try {
    const result = await getProfitLoss(tenantId, { period, scope: "monthly" });
    queryClient.setQueryData(
      profitLossKeys.detail(tenantId, clientParams),
      result
    );
  } catch (error) {
    console.error("[profit-loss prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfitLossClient />
    </HydrationBoundary>
  );
}
