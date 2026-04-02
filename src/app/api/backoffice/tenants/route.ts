import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      taxId: tenants.taxId,
      ownerUserId: tenants.ownerUserId,
      isVatRegistered: tenants.isVatRegistered,
      baseCurrency: tenants.baseCurrency,
      monthlyBudgetUsd: tenants.monthlyBudgetUsd,
      budgetAlertThreshold: tenants.budgetAlertThreshold,
      createdAt: tenants.createdAt,
      deletedAt: tenants.deletedAt,
      memberCount: sql<number>`(SELECT count(*)::int FROM tenant_assignments WHERE tenant_assignments.tenant_id = "tenants"."id")`,
      documentCount: sql<number>`(SELECT count(*)::int FROM documents WHERE documents.tenant_id = "tenants"."id")`,
    })
    .from(tenants);

  const data = rows.map((row) => ({
    ...row,
    memberCount: Number(row.memberCount) || 0,
    documentCount: Number(row.documentCount) || 0,
    monthlyBudgetUsd: row.monthlyBudgetUsd !== null ? Number(row.monthlyBudgetUsd) : null,
  }));

  return NextResponse.json({ success: true, data });
}
