import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getBalanceSheet } from "@/lib/db/queries/balance-sheet";
import { balanceSheetKeys } from "@/lib/hooks/use-balance-sheet";
import BalanceSheetClient from "./balance-sheet-client";

export default async function BalanceSheetPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <BalanceSheetClient />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const clientParams = { period, scope: "monthly", comparison: undefined };

  const queryClient = new QueryClient();
  try {
    const result = await getBalanceSheet(tenantId, { period, scope: "monthly" });
    queryClient.setQueryData(
      balanceSheetKeys.detail(tenantId, clientParams),
      result
    );
  } catch (error) {
    console.error("[balance-sheet prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BalanceSheetClient />
    </HydrationBoundary>
  );
}
