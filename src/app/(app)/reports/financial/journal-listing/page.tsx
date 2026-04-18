import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getJournalListing } from "@/lib/db/queries/journal-listing";
import { journalListingKeys } from "@/lib/hooks/use-journal-listing";
import JournalListingClient from "./journal-listing-client";

export default async function JournalListingPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <JournalListingClient />;
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const clientParams = {
    period,
    scope: "monthly",
    type: undefined,
    page: 1,
    limit: 50,
  };

  const queryClient = new QueryClient();
  try {
    const result = await getJournalListing(tenantId, {
      period,
      scope: "monthly",
      page: 1,
      limit: 50,
    });
    queryClient.setQueryData(
      journalListingKeys.detail(tenantId, clientParams),
      result
    );
  } catch (error) {
    console.error("[journal-listing prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <JournalListingClient />
    </HydrationBoundary>
  );
}
