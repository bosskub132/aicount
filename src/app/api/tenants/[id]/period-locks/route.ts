import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodLocks } from "@/lib/db/schema";
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
    .from(periodLocks)
    .where(eq(periodLocks.tenantId, id))
    .orderBy(desc(periodLocks.yearMonth));
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
    if (!ensureRole(ctx.role, ["admin", "checker"])) {
      return forbidden("Only checker/admin can lock period");
    }

    const body = (await request.json()) as { yearMonth: string };
    const [created] = await db
      .insert(periodLocks)
      .values({
        tenantId: id,
        yearMonth: body.yearMonth,
        lockedBy: ctx.userId,
      })
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "period.locked",
      entityType: "period_lock",
      entityId: created.id,
      metadata: { yearMonth: body.yearMonth },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause;
    if (cause?.code === "23505") {
      return NextResponse.json({ success: false, error: "This period is already locked." }, { status: 409 });
    }
    console.error("Period lock error:", error);
    return NextResponse.json({ success: false, error: "Failed to lock period." }, { status: 500 });
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
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
    if (!ensureRole(ctx.role, ["admin"])) {
      return forbidden("Only admin can unlock period");
    }

    const body = (await request.json()) as { periodLockId?: string; yearMonth?: string };
    const [deleted] = body.periodLockId
      ? await db
          .delete(periodLocks)
          .where(and(eq(periodLocks.id, body.periodLockId), eq(periodLocks.tenantId, id)))
          .returning()
      : await db
          .delete(periodLocks)
          .where(and(eq(periodLocks.yearMonth, body.yearMonth || ""), eq(periodLocks.tenantId, id)))
          .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "period.unlocked",
      entityType: "period_lock",
      entityId: deleted?.id || null,
      metadata: body,
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: deleted ?? null });
  } catch (error) {
    console.error("Period unlock error:", error);
    return NextResponse.json({ success: false, error: "Failed to unlock period." }, { status: 500 });
  }
}

