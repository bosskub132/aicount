import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getTrialBalance } from "@/lib/db/queries/trial-balance";
import { trialBalanceKeys } from "@/lib/hooks/use-trial-balance";
import TrialBalanceClient from "./trial-balance-client";

export default async function TrialBalancePage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <TrialBalanceClient />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const clientParams = { period, scope: "monthly", department: undefined };

  const queryClient = new QueryClient();
  try {
    const result = await getTrialBalance(tenantId, { period, scope: "monthly" });
    queryClient.setQueryData(
      trialBalanceKeys.detail(tenantId, clientParams),
      result
    );
  } catch (error) {
    console.error("[trial-balance prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TrialBalanceClient />
    </HydrationBoundary>
  );
}
