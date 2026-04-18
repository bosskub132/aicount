import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listDocuments } from "@/lib/db/queries/documents";
import { documentKeys } from "@/lib/hooks/use-documents";
import DocumentsClient from "./documents-client";

export default async function DocumentsPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) {
    redirect("/login");
  }

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    redirect("/dashboard");
  }

  // Must match DocumentsPageContent's useDocuments call exactly.
  // Client passes: { page, limit: 100, search: debouncedSearch || undefined }
  // with initial state page=1, debouncedSearch="" → search becomes undefined.
  const clientParams = { page: 1, limit: 100, search: undefined };
  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: documentKeys.list(tenantId, clientParams),
      queryFn: async () => {
        const result = await listDocuments(tenantId, { page: 1, limit: 100 });
        return { success: true, ...result };
      },
    });
  } catch (error) {
    console.error("[documents prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DocumentsClient />
    </HydrationBoundary>
  );
}
