import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listCustomers } from "@/lib/db/queries/master-data";
import { customersKeys } from "@/lib/hooks/use-master-data";
import CustomersClient from "./customers-client";

export default async function CustomersPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <CustomersClient />;
  }

  const clientParams = { page: 1, limit: 50, search: undefined };

  const queryClient = new QueryClient();
  try {
    const result = await listCustomers(tenantId, { page: 1, limit: 50 });
    queryClient.setQueryData(customersKeys.list(tenantId, clientParams), {
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
    console.error("[customers prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CustomersClient />
    </HydrationBoundary>
  );
}
