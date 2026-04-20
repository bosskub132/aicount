import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, tenantAssignments, tenants } from "@/lib/db/schema";

export interface CreateTenantInput {
  ownerUserId: string;
  name: string;
  taxId: string;
  industry?: string;
  companySize?: string;
}

export async function createTenantWithOwner(input: CreateTenantInput) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tenants)
      .values({
        name: input.name,
        taxId: input.taxId,
        industry: input.industry,
        companySize: input.companySize,
        ownerUserId: input.ownerUserId,
      })
      .returning();

    await tx
      .insert(tenantAssignments)
      .values([
        { tenantId: created.id, userId: input.ownerUserId, role: "maker" as const },
        { tenantId: created.id, userId: input.ownerUserId, role: "checker" as const },
      ])
      .returning();

    return created;
  });
}

export interface PatchOnboardingInput {
  tenantId: string;
  onboardingStep?: number;
  isOnboardingComplete?: boolean;
}

export async function patchTenantOnboarding(input: PatchOnboardingInput) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof input.onboardingStep === "number") {
    const clamped = Math.max(0, Math.min(8, input.onboardingStep));
    updates.onboardingStep = sql`GREATEST(${tenants.onboardingStep}, ${clamped})`;
  }

  if (typeof input.isOnboardingComplete === "boolean") {
    updates.isOnboardingComplete = input.isOnboardingComplete;
  }

  const [updated] = await db
    .update(tenants)
    .set(updates)
    .where(eq(tenants.id, input.tenantId))
    .returning();

  return updated;
}

export async function resolveDefaultTenant(userId: string): Promise<string | null> {
  const withDefault = await db
    .select({
      defaultTenantId: profiles.defaultTenantId,
      hasAssignment: tenantAssignments.tenantId,
    })
    .from(profiles)
    .leftJoin(
      tenantAssignments,
      and(
        eq(tenantAssignments.userId, profiles.id),
        eq(tenantAssignments.tenantId, profiles.defaultTenantId)
      )
    )
    .where(eq(profiles.id, userId))
    .limit(1);

  const row = withDefault[0];
  if (row?.defaultTenantId && row.hasAssignment) {
    return row.defaultTenantId;
  }

  const oldest = await db
    .select({ tenantId: tenantAssignments.tenantId })
    .from(tenantAssignments)
    .where(eq(tenantAssignments.userId, userId))
    .orderBy(asc(tenantAssignments.createdAt))
    .limit(1);

  return oldest[0]?.tenantId ?? null;
}

export interface TenantWithState {
  tenantId: string;
  tenantName: string;
  taxId: string;
  roles: string[];
  isOnboardingComplete: boolean;
  isDefault: boolean;
}

export async function listUserTenantsWithState(userId: string): Promise<TenantWithState[]> {
  const [profile] = await db
    .select({ defaultTenantId: profiles.defaultTenantId })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const defaultId = profile?.defaultTenantId ?? null;

  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      taxId: tenants.taxId,
      role: tenantAssignments.role,
      isOnboardingComplete: tenants.isOnboardingComplete,
    })
    .from(tenantAssignments)
    .leftJoin(tenants, eq(tenantAssignments.tenantId, tenants.id))
    .where(eq(tenantAssignments.userId, userId));

  const byTenant = new Map<string, TenantWithState>();
  for (const row of rows) {
    if (!row.tenantId) continue;
    const existing = byTenant.get(row.tenantId);
    if (existing) {
      existing.roles.push(row.role);
    } else {
      byTenant.set(row.tenantId, {
        tenantId: row.tenantId,
        tenantName: row.tenantName ?? "",
        taxId: row.taxId ?? "",
        roles: [row.role],
        isOnboardingComplete: row.isOnboardingComplete ?? false,
        isDefault: row.tenantId === defaultId,
      });
    }
  }

  return Array.from(byTenant.values());
}
