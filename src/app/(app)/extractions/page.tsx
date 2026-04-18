import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getDocumentWithLines } from "@/lib/db/queries/documents";
import { documentKeys } from "@/lib/hooks/use-documents";
import ExtractionsClient from "./extractions-client";

export default async function ExtractionsPage({
  searchParams,
}: {
  searchParams: Promise<{ docId?: string }>;
}) {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <ExtractionsClient />;
  }

  const { docId } = await searchParams;
  const queryClient = new QueryClient();

  if (docId) {
    try {
      await queryClient.prefetchQuery({
        queryKey: documentKeys.detail(docId, tenantId),
        queryFn: () => getDocumentWithLines(docId, tenantId),
      });
    } catch (error) {
      console.error("[extractions prefetch]", error);
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExtractionsClient />
    </HydrationBoundary>
  );
}
