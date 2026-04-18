import { and, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, vendors, customers, products, chartOfAccounts } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") || ctx.tenantId;
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ success: false, error: "q is required" }, { status: 400 });
  }
  if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");

  const pattern = `%${q}%`;
  const [docs, vRows, cRows, pRows, coaRows] = await Promise.all([
    db
      .select({ id: documents.id, label: documents.issuerName })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), or(ilike(documents.issuerName, pattern), ilike(documents.documentNumber, pattern))))
      .limit(20),
    db
      .select({ id: vendors.id, label: vendors.name })
      .from(vendors)
      .where(and(eq(vendors.tenantId, tenantId), ilike(vendors.name, pattern)))
      .limit(20),
    db
      .select({ id: customers.id, label: customers.name })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), ilike(customers.name, pattern)))
      .limit(20),
    db
      .select({ id: products.id, label: products.itemName })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), ilike(products.itemName, pattern)))
      .limit(20),
    db
      .select({ id: chartOfAccounts.id, label: chartOfAccounts.accountName })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.tenantId, tenantId), ilike(chartOfAccounts.accountName, pattern)))
      .limit(20),
  ]);

  return NextResponse.json({
    success: true,
    data: [
      ...docs.map((r) => ({ ...r, type: "document" })),
      ...vRows.map((r) => ({ ...r, type: "vendor" })),
      ...cRows.map((r) => ({ ...r, type: "customer" })),
      ...pRows.map((r) => ({ ...r, type: "product" })),
      ...coaRows.map((r) => ({ ...r, type: "coa" })),
    ],
  });
}

