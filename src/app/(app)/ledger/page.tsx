import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import {
  listJournalEntries,
  getJournalEntryStats,
} from "@/lib/db/queries/journal-entries";
import { journalEntriesKeys } from "@/lib/hooks/use-journal-entries";
import LedgerClient from "./ledger-client";

export default async function LedgerPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <LedgerClient />;
  }

  // Match the default filters useJournalEntries is called with on first render
  // (status=undefined, dateFrom=undefined, dateTo=undefined, page=1, limit=20,
  //  search=undefined) — see src/app/(app)/ledger/ledger-client.tsx
  const clientFilters = {
    status: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    page: 1,
    limit: 20,
    search: undefined,
  };

  const queryClient = new QueryClient();
  try {
    const result = await listJournalEntries(db, tenantId, {
      page: 1,
      pageSize: 20,
    });
    const now = new Date();
    const stats = await getJournalEntryStats(
      db,
      tenantId,
      `${now.getFullYear()}-01-01`,
      now.toISOString().slice(0, 10)
    );
    queryClient.setQueryData(journalEntriesKeys.list(tenantId, clientFilters), {
      success: true,
      data: {
        entries: result.entries,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        stats,
      },
    });
  } catch (error) {
    console.error("[ledger prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LedgerClient />
    </HydrationBoundary>
  );
}
