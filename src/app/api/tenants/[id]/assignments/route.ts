import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles, tenantAssignments } from "@/lib/db/schema";
import { ensureRole, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";
import { validateCsrf } from "@/lib/api/csrf";

const CreateAssignmentSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["maker", "checker"]),
});

const DeleteAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (ctx.tenantId !== id && !ensureRole(ctx.role, ["admin"])) return forbidden("Cross-tenant access denied");

  const rows = await db
    .select({
      assignmentId: tenantAssignments.id,
      tenantId: tenantAssignments.tenantId,
      userId: tenantAssignments.userId,
      assignmentRole: tenantAssignments.role,
      email: profiles.email,
      name: profiles.name,
      appRole: profiles.role,
    })
    .from(tenantAssignments)
    .innerJoin(profiles, eq(tenantAssignments.userId, profiles.id))
    .where(eq(tenantAssignments.tenantId, id));

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(
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
    if (!ensureRole(ctx.role, ["admin", "checker"])) {
      return forbidden("Only checker/admin can assign staff");
    }
    if (ctx.tenantId !== id && !ensureRole(ctx.role, ["admin"])) return forbidden("Cross-tenant access denied");

    const parsed = CreateAssignmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const body = parsed.data;

    const [created] = await db
      .insert(tenantAssignments)
      .values({
        tenantId: id,
        userId: body.userId,
        role: body.role,
      })
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.assignment.created",
      entityType: "tenant_assignment",
      entityId: created.id,
      metadata: body,
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[tenants/:id/assignments POST]", error);
    return NextResponse.json(
      { success: false, error: "Create assignment failed" },
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
    if (!ensureRole(ctx.role, ["admin", "checker"])) {
      return forbidden("Only checker/admin can remove assignment");
    }
    if (ctx.tenantId !== id && !ensureRole(ctx.role, ["admin"])) return forbidden("Cross-tenant access denied");

    const parsedDelete = DeleteAssignmentSchema.safeParse(await request.json());
    if (!parsedDelete.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const body = parsedDelete.data;
    const [deleted] = await db
      .delete(tenantAssignments)
      .where(and(eq(tenantAssignments.id, body.assignmentId), eq(tenantAssignments.tenantId, id)))
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.assignment.deleted",
      entityType: "tenant_assignment",
      entityId: body.assignmentId,
      metadata: { assignmentId: body.assignmentId },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: deleted ?? null });
  } catch (error) {
    console.error("[tenants/:id/assignments DELETE]", error);
    return NextResponse.json(
      { success: false, error: "Delete assignment failed" },
      { status: 500 }
    );
  }
}

