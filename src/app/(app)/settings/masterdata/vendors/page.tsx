import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listVendors } from "@/lib/db/queries/master-data";
import { vendorsKeys } from "@/lib/hooks/use-master-data";
import VendorsClient from "./vendors-client";

export default async function VendorsPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <VendorsClient />;
  }

  const clientParams = { page: 1, limit: 50, search: undefined };

  const queryClient = new QueryClient();
  try {
    const result = await listVendors(tenantId, { page: 1, limit: 50 });
    queryClient.setQueryData(vendorsKeys.list(tenantId, clientParams), {
      success: true,
      data: result.rows,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("[vendors prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VendorsClient />
    </HydrationBoundary>
  );
}
