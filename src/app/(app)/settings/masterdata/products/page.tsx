import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listProducts } from "@/lib/db/queries/master-data";
import { productsKeys } from "@/lib/hooks/use-master-data";
import ProductsClient from "./products-client";

export default async function ProductsPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <ProductsClient />;
  }

  const clientParams = { page: 1, limit: 50, search: undefined };

  const queryClient = new QueryClient();
  try {
    const result = await listProducts(tenantId, { page: 1, limit: 50 });
    queryClient.setQueryData(productsKeys.list(tenantId, clientParams), {
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
    console.error("[products prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductsClient />
    </HydrationBoundary>
  );
}
