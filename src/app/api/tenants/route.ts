import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";
import { TENANT_COMPANY_SIZES, TENANT_INDUSTRIES } from "@/lib/utils/constants";
import { createTenantWithOwner, listUserTenantsWithState } from "@/lib/db/queries/tenants";

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(200),
  taxId: z.string().regex(/^\d{13}$/),
  industry: z.enum(TENANT_INDUSTRIES).optional(),
  companySize: z.enum(TENANT_COMPANY_SIZES).optional(),
});

export async function GET(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const list = await listUserTenantsWithState(ctx.userId);
  const assigned = list.map((t) => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName,
    taxId: t.taxId,
    role: t.roles.join(", "),
    isOnboardingComplete: t.isOnboardingComplete,
    isDefault: t.isDefault,
  }));

  return NextResponse.json({ success: true, data: assigned });
}

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const parsed = CreateTenantSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const body = parsed.data;

    const existingCount = await db
      .select({ id: tenantAssignments.id })
      .from(tenantAssignments)
      .where(eq(tenantAssignments.userId, ctx.userId))
      .limit(1);
    const isFirstWorkspace = existingCount.length === 0;

    let created;
    try {
      created = await createTenantWithOwner({
        ownerUserId: ctx.userId,
        name: body.name,
        taxId: body.taxId,
        industry: body.industry,
        companySize: body.companySize,
      });
    } catch (error) {
      const cause = (error as { cause?: { code?: string } })?.cause?.code;
      if (cause === "23505") {
        return NextResponse.json(
          { success: false, error: "A workspace with this tax ID already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    await writeAuditLog({
      tenantId: created.id,
      userId: ctx.userId,
      action: "tenant.created",
      entityType: "tenant",
      entityId: created.id,
      metadata: { name: created.name, taxId: created.taxId, isFirstWorkspace },
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
