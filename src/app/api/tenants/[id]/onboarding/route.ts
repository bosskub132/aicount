import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import {
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { patchTenantOnboarding } from "@/lib/db/queries/tenants";
import { writeAuditLog } from "@/lib/services/audit";

const PatchSchema = z.object({
  onboardingStep: z.number().int().min(0).max(8).optional(),
  isOnboardingComplete: z.boolean().optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) {
    return forbidden("Cross-tenant access denied");
  }

  const [row] = await db
    .select({
      id: tenants.id,
      onboardingStep: tenants.onboardingStep,
      isOnboardingComplete: tenants.isOnboardingComplete,
    })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: row });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) {
    return forbidden("Cross-tenant access denied");
  }

  const parsed = PatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
  }

  const updated = await patchTenantOnboarding({
    tenantId: id,
    onboardingStep: parsed.data.onboardingStep,
    isOnboardingComplete: parsed.data.isOnboardingComplete,
  });

  if (parsed.data.isOnboardingComplete === true) {
    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "workspace.onboarding_completed",
      entityType: "tenant",
      entityId: id,
      ipAddress: ctx.ipAddress,
    });
  }

  return NextResponse.json({ success: true, data: updated });
}
