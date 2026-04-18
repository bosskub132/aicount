import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import {
  getReceivablesAging,
  getReceivablesStats,
} from "@/lib/db/queries/receivables";
import { receivablesKeys } from "@/lib/hooks/use-receivables";
import ReceivablesClient from "./receivables-client";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function ReceivablesPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <ReceivablesClient />;
  }

  const dateFrom = firstOfMonthISO();
  const dateTo = todayISO();
  const clientFilters = {
    status: undefined,
    dateFrom,
    dateTo,
    page: 1,
    limit: 20,
    search: undefined,
  };

  const queryClient = new QueryClient();
  try {
    const aging = await getReceivablesAging(db, tenantId, {
      dateFrom,
      dateTo,
      page: 1,
      pageSize: 20,
    });
    const stats = await getReceivablesStats(db, tenantId);
    queryClient.setQueryData(receivablesKeys.list(tenantId, clientFilters), {
      success: true,
      data: { ...aging, summary: stats },
    });
  } catch (error) {
    console.error("[receivables prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReceivablesClient />
    </HydrationBoundary>
  );
}
