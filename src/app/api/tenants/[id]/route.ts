import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
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
import { validateCsrf } from "@/lib/api/csrf";

const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  taxId: z.string().regex(/^\d{13}$/).optional(),
  isVatRegistered: z.boolean().optional(),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
  dataRetentionYears: z.number().int().min(1).max(50).optional(),
});

const PatchTenantSchema = z.object({
  action: z.literal("soft_delete"),
});

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
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;

    if (!ensureTenantScope(ctx.tenantId, id) && !ensureRole(ctx.role, ["admin"])) {
      return forbidden("Cross-tenant access denied");
    }

    const parsed = UpdateTenantSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const body = parsed.data;

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;

    const [tenant] = await db
      .select({ ownerUserId: tenants.ownerUserId })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }
    if (tenant.ownerUserId !== ctx.userId) {
      return forbidden("Only workspace owner can delete workspace");
    }

    const parsedPatch = PatchTenantSchema.safeParse(await request.json());
    if (!parsedPatch.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(tenants)
      .set({
        deletedAt: now,
        deletionScheduledFor: scheduledFor,
        deletionReason: "owner_request",
        updatedAt: now,
      })
      .where(eq(tenants.id, id))
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.deletion_initiated",
      entityType: "tenant",
      entityId: id,
      metadata: { scheduledFor: scheduledFor.toISOString() },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }
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

