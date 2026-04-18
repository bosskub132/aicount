import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getPp30 } from "@/lib/db/queries/tax-pp30";
import { taxPp30Keys } from "@/lib/hooks/use-tax-pp30";
import Pp30Client from "./pp30-client";

export default async function Pp30Page() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <Pp30Client />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const queryClient = new QueryClient();
  try {
    const result = await getPp30(tenantId, period);
    queryClient.setQueryData(taxPp30Keys.detail(tenantId, { period }), result);
  } catch (error) {
    console.error("[pp30 prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Pp30Client />
    </HydrationBoundary>
  );
}
