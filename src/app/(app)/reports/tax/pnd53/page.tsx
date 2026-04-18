import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getPnd53 } from "@/lib/db/queries/tax-pnd53";
import { taxPnd53Keys } from "@/lib/hooks/use-tax-pnd53";
import Pnd53Client from "./pnd53-client";

export default async function Pnd53Page() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <Pnd53Client />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const queryClient = new QueryClient();
  try {
    const result = await getPnd53(tenantId, period);
    queryClient.setQueryData(taxPnd53Keys.detail(tenantId, { period }), result);
  } catch (error) {
    console.error("[pnd53 prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Pnd53Client />
    </HydrationBoundary>
  );
}
