import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listCertificates } from "@/lib/db/queries/wht-certificates";
import { whtCertificatesKeys } from "@/lib/hooks/use-wht-certificates";
import WhtClient from "./wht-client";

export default async function WhtPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <WhtClient />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const clientParams = {
    period,
    search: undefined,
    status: undefined,
    page: 1,
    limit: 50,
  };

  const queryClient = new QueryClient();
  try {
    const result = await listCertificates(tenantId, {
      period,
      page: 1,
      limit: 50,
    });
    queryClient.setQueryData(
      whtCertificatesKeys.list(tenantId, clientParams),
      result
    );
  } catch (error) {
    console.error("[wht prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WhtClient />
    </HydrationBoundary>
  );
}
