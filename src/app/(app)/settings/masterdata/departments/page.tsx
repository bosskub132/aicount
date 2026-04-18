import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listDepartments } from "@/lib/db/queries/master-data";
import { departmentsKeys } from "@/lib/hooks/use-master-data";
import DepartmentsClient from "./departments-client";

export default async function DepartmentsPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <DepartmentsClient />;
  }

  const clientParams = { page: 1, limit: 50, search: undefined };

  const queryClient = new QueryClient();
  try {
    const result = await listDepartments(tenantId, { page: 1, limit: 50 });
    queryClient.setQueryData(departmentsKeys.list(tenantId, clientParams), {
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
    console.error("[departments prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DepartmentsClient />
    </HydrationBoundary>
  );
}
