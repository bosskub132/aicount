import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getCashFlow } from "@/lib/db/queries/cash-flow";
import { cashFlowKeys } from "@/lib/hooks/use-cash-flow";
import CashFlowClient from "./cash-flow-client";

export default async function CashFlowPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <CashFlowClient />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const clientParams = { period, scope: "monthly", comparison: undefined };

  const queryClient = new QueryClient();
  try {
    const result = await getCashFlow(tenantId, { period, scope: "monthly" });
    queryClient.setQueryData(
      cashFlowKeys.detail(tenantId, clientParams),
      result
    );
  } catch (error) {
    console.error("[cash-flow prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CashFlowClient />
    </HydrationBoundary>
  );
}
