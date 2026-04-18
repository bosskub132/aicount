import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getVatRegister } from "@/lib/db/queries/vat-register";
import { vatRegisterKeys } from "@/lib/hooks/use-vat-register";
import SalesVatClient from "./sales-vat-client";

export default async function SalesVatPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <SalesVatClient />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const clientParams = { period, direction: "REVENUE" as const };

  const queryClient = new QueryClient();
  try {
    const result = await getVatRegister(tenantId, period, "REVENUE");
    queryClient.setQueryData(
      vatRegisterKeys.detail(tenantId, clientParams),
      result
    );
  } catch (error) {
    console.error("[sales-vat prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SalesVatClient />
    </HydrationBoundary>
  );
}
