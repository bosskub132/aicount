import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  chartOfAccounts,
  customers,
  departments,
  documents,
  products,
  tenants,
  vendors,
} from "@/lib/db/schema";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id) && !ensureRole(ctx.role, ["admin"])) {
    return forbidden("Cross-tenant access denied");
  }

  const [tenant, coa, vendorRows, customerRows, productRows, departmentRows, docRows] = await Promise.all([
    db.select().from(tenants).where(eq(tenants.id, id)).then((rows) => rows[0] || null),
    db.select().from(chartOfAccounts).where(eq(chartOfAccounts.tenantId, id)),
    db.select().from(vendors).where(eq(vendors.tenantId, id)),
    db.select().from(customers).where(eq(customers.tenantId, id)),
    db.select().from(products).where(eq(products.tenantId, id)),
    db.select().from(departments).where(eq(departments.tenantId, id)),
    db.select().from(documents).where(eq(documents.tenantId, id)),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      exportedAt: new Date().toISOString(),
      tenant,
      chartOfAccounts: coa,
      vendors: vendorRows,
      customers: customerRows,
      products: productRows,
      departments: departmentRows,
      documents: docRows,
    },
  });
}

