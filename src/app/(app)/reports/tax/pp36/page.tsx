import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getPp36 } from "@/lib/db/queries/tax-pp36";
import { taxPp36Keys } from "@/lib/hooks/use-tax-pp36";
import Pp36Client from "./pp36-client";

export default async function Pp36Page() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <Pp36Client />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const queryClient = new QueryClient();
  try {
    const result = await getPp36(tenantId, period);
    queryClient.setQueryData(taxPp36Keys.detail(tenantId, { period }), result);
  } catch (error) {
    console.error("[pp36 prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Pp36Client />
    </HydrationBoundary>
  );
}
