import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tenantAssignments, tenants } from "@/lib/db/schema";
import { ensureRole, getRequestContext, resolveUserRole, unauthorized } from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";
import { TENANT_COMPANY_SIZES, TENANT_INDUSTRIES } from "@/lib/utils/constants";

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(200),
  taxId: z.string().regex(/^\d{13}$/),
  industry: z.enum(TENANT_INDUSTRIES).optional(),
  companySize: z.enum(TENANT_COMPANY_SIZES).optional(),
});

export async function GET(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const rows = await db
    .select({
      assignmentId: tenantAssignments.id,
      role: tenantAssignments.role,
      tenantId: tenants.id,
      tenantName: tenants.name,
      taxId: tenants.taxId,
    })
    .from(tenantAssignments)
    .innerJoin(tenants, eq(tenantAssignments.tenantId, tenants.id))
    .where(eq(tenantAssignments.userId, ctx.userId));

  // Deduplicate by tenantId, combine roles into a comma-separated string
  const byTenant = new Map<string, { assignmentId: string; tenantId: string; tenantName: string; taxId: string; roles: string[] }>();
  for (const row of rows) {
    const existing = byTenant.get(row.tenantId);
    if (existing) {
      existing.roles.push(row.role);
    } else {
      byTenant.set(row.tenantId, {
        assignmentId: row.assignmentId,
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        taxId: row.taxId,
        roles: [row.role],
      });
    }
  }

  const assigned = Array.from(byTenant.values()).map((t) => ({
    assignmentId: t.assignmentId,
    role: t.roles.join(", "),
    tenantId: t.tenantId,
    tenantName: t.tenantName,
    taxId: t.taxId,
  }));

  return NextResponse.json({ success: true, data: assigned });
}

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    // Allow any authenticated user to create their first tenant (onboarding).
    // Admin role is only enforced for users who already have tenant assignments.
    const existingAssignments = await db
      .select({ id: tenantAssignments.id })
      .from(tenantAssignments)
      .where(eq(tenantAssignments.userId, ctx.userId))
      .limit(1);

    if (existingAssignments.length > 0) {
      const realRole = await resolveUserRole(ctx.userId, ctx.tenantId);
      if (!ensureRole(realRole, ["admin"])) {
        return NextResponse.json({ success: false, error: "Only admin can create additional tenants" }, { status: 403 });
      }
    }

    const parsed = CreateTenantSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const body = parsed.data;

    const ownerUserId = ctx.userId;
    const [created] = await db
      .insert(tenants)
      .values({
        name: body.name,
        taxId: body.taxId,
        industry: body.industry,
        companySize: body.companySize,
        ownerUserId,
      })
      .returning();

    // Grant workspace creator both maker and checker roles (admin-level access)
    await db.insert(tenantAssignments).values([
      { tenantId: created.id, userId: ownerUserId, role: "maker" as const },
      { tenantId: created.id, userId: ownerUserId, role: "checker" as const },
    ]);

    await writeAuditLog({
      tenantId: created.id,
      userId: ctx.userId,
      action: "tenant.created",
      entityType: "tenant",
      entityId: created.id,
      metadata: { name: created.name, taxId: created.taxId },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[tenants POST]", error);
    return NextResponse.json(
      { success: false, error: "Create tenant failed" },
      { status: 500 }
    );
  }
}

