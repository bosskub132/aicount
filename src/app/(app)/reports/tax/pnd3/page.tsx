import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getPnd3 } from "@/lib/db/queries/tax-pnd3";
import { taxPnd3Keys } from "@/lib/hooks/use-tax-pnd3";
import Pnd3Client from "./pnd3-client";

export default async function Pnd3Page() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <Pnd3Client />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const queryClient = new QueryClient();
  try {
    const result = await getPnd3(tenantId, period);
    queryClient.setQueryData(taxPnd3Keys.detail(tenantId, { period }), result);
  } catch (error) {
    console.error("[pnd3 prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Pnd3Client />
    </HydrationBoundary>
  );
}
