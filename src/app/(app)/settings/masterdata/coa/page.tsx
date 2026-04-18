import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listCoa } from "@/lib/db/queries/master-data";
import { coaKeys } from "@/lib/hooks/use-master-data";
import CoaClient from "./coa-client";

export default async function CoaPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <CoaClient />;
  }

  const clientParams = { page: 1, limit: 50, search: undefined };

  const queryClient = new QueryClient();
  try {
    const result = await listCoa(tenantId, { page: 1, limit: 50 });
    queryClient.setQueryData(coaKeys.list(tenantId, clientParams), {
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
    console.error("[coa prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CoaClient />
    </HydrationBoundary>
  );
}
