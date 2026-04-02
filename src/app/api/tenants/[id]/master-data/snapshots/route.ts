import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  auditLogs,
  chartOfAccounts,
  customers,
  departments,
  products,
  vendors,
} from "@/lib/db/schema";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.tenantId, id), eq(auditLogs.action, "master_data.snapshot.created")))
    .orderBy(desc(auditLogs.createdAt));
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
    if (!ensureRole(ctx.role, ["admin", "checker"])) return forbidden("Only checker/admin can create snapshots");

    const body = (await request.json()) as { label?: string };
    const [coa, vendorRows, customerRows, productRows, departmentRows] = await Promise.all([
      db.select().from(chartOfAccounts).where(eq(chartOfAccounts.tenantId, id)),
      db.select().from(vendors).where(eq(vendors.tenantId, id)),
      db.select().from(customers).where(eq(customers.tenantId, id)),
      db.select().from(products).where(eq(products.tenantId, id)),
      db.select().from(departments).where(eq(departments.tenantId, id)),
    ]);

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "master_data.snapshot.created",
      entityType: "master_data_snapshot",
      metadata: {
        label: body.label || null,
        counts: {
          coa: coa.length,
          vendors: vendorRows.length,
          customers: customerRows.length,
          products: productRows.length,
          departments: departmentRows.length,
        },
        payload: {
          chartOfAccounts: coa,
          vendors: vendorRows,
          customers: customerRows,
          products: productRows,
          departments: departmentRows,
        },
      },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: { created: true } }, { status: 201 });
  } catch (error) {
    console.error("[tenants/:id/master-data/snapshots POST]", error);
    return NextResponse.json(
      { success: false, error: "Create snapshot failed" },
      { status: 500 }
    );
  }
}

