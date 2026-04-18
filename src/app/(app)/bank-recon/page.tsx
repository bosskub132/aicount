import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { bankStatements } from "@/lib/db/schema";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { bankStatementsKeys } from "@/lib/hooks/use-bank-recon-statements";
import BankReconClient from "./bank-recon-client";

export default async function BankReconPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    return <BankReconClient />;
  }

  const queryClient = new QueryClient();
  try {
    const rows = await db
      .select()
      .from(bankStatements)
      .where(eq(bankStatements.tenantId, tenantId))
      .orderBy(desc(bankStatements.statementDate));
    queryClient.setQueryData(bankStatementsKeys.list(tenantId), rows);
  } catch (error) {
    console.error("[bank-recon prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BankReconClient />
    </HydrationBoundary>
  );
}
