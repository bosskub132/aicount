import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getVatRegister } from "@/lib/db/queries/vat-register";
import { vatRegisterKeys } from "@/lib/hooks/use-vat-register";
import PurchaseVatClient from "./purchase-vat-client";

export default async function PurchaseVatPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <PurchaseVatClient />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const clientParams = { period, direction: "EXPENSE" as const };

  const queryClient = new QueryClient();
  try {
    const result = await getVatRegister(tenantId, period, "EXPENSE");
    queryClient.setQueryData(
      vatRegisterKeys.detail(tenantId, clientParams),
      result
    );
  } catch (error) {
    console.error("[purchase-vat prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PurchaseVatClient />
    </HydrationBoundary>
  );
}
