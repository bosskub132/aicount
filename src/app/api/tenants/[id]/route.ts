import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenantAssignments, tenants } from "@/lib/db/schema";
import {
  ensureRole,
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";

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

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) {
    return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: tenant });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;

    if (!ensureTenantScope(ctx.tenantId, id) && !ensureRole(ctx.role, ["admin"])) {
      return forbidden("Cross-tenant access denied");
    }

    const body = (await request.json()) as {
      name?: string;
      taxId?: string;
      isVatRegistered?: boolean;
      baseCurrency?: string;
      dataRetentionYears?: number;
    };

    const [updated] = await db
      .update(tenants)
      .set({
        name: body.name,
        taxId: body.taxId,
        isVatRegistered: body.isVatRegistered,
        baseCurrency: body.baseCurrency,
        dataRetentionYears: body.dataRetentionYears,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.updated",
      entityType: "tenant",
      entityId: id,
      metadata: body,
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Update tenant failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureRole(ctx.role, ["admin"])) {
      return forbidden("Only admin can delete tenant");
    }

    await db.delete(tenantAssignments).where(eq(tenantAssignments.tenantId, id));
    await db.delete(tenants).where(eq(tenants.id, id));

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.deleted",
      entityType: "tenant",
      entityId: id,
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Delete tenant failed" },
      { status: 500 }
    );
  }
}

