/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, vendors } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const rows = await db
    .select({
      vendorTaxId: documents.issuerTaxId,
      vendorName: sql<string>`coalesce(${vendors.name}, ${documents.issuerName}, 'Unknown Vendor')`,
      totalAmount: sql<number>`coalesce(sum(${documents.grandTotal}),0)`,
      totalVat: sql<number>`coalesce(sum(${documents.vatAmount}),0)`,
      docCount: sql<number>`count(*)::int`,
    })
    .from(documents)
    .leftJoin(vendors, and(eq(vendors.tenantId, documents.tenantId), eq(vendors.taxId, documents.issuerTaxId)))
    .where(and(eq(documents.tenantId, id), eq(documents.direction, "EXPENSE" as any), eq(documents.status, "APPROVED")))
    .groupBy(documents.issuerTaxId, vendors.name, documents.issuerName)
    .orderBy(sql`coalesce(sum(${documents.grandTotal}),0) desc`);

  return NextResponse.json({ success: true, data: rows });
}

