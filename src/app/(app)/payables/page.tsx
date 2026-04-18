import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getPayablesAging, getPayablesStats } from "@/lib/db/queries/payables";
import type { PaymentStatus } from "@/lib/services/payment-status";

const VALID_STATUSES: PaymentStatus[] = ["open", "partial", "paid", "overdue"];
import { payablesKeys } from "@/lib/hooks/use-payables";
import PayablesClient from "./payables-client";

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <PayablesClient />;
  }

  const { status: statusParam } = await searchParams;
  const status = statusParam || "";
  const validStatus = VALID_STATUSES.includes(status as PaymentStatus)
    ? (status as PaymentStatus)
    : undefined;
  const clientFilters = { status, search: "", page: 1, limit: 20 };

  const queryClient = new QueryClient();
  try {
    const aging = await getPayablesAging(db, tenantId, {
      status: validStatus,
      page: 1,
      pageSize: 20,
    });
    const stats = await getPayablesStats(db, tenantId);
    queryClient.setQueryData(payablesKeys.list(tenantId, clientFilters), {
      success: true,
      data: { ...aging, summary: stats },
    });
  } catch (error) {
    console.error("[payables prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PayablesClient />
    </HydrationBoundary>
  );
}
