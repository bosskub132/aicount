import { randomUUID } from "node:crypto";

export function makeTenantId(): string {
  return randomUUID();
}

export function makeUserId(): string {
  return randomUUID();
}

export function makeAssignmentRow(
  overrides: Partial<{ userId: string; tenantId: string; role: "maker" | "checker" }> = {}
) {
  return {
    userId: overrides.userId ?? makeUserId(),
    tenantId: overrides.tenantId ?? makeTenantId(),
    role: overrides.role ?? "maker",
  };
}

export function makeTenantRow(
  overrides: Partial<{
    id: string;
    name: string;
    taxId: string;
    isOnboardingComplete: boolean;
    onboardingStep: number;
  }> = {}
) {
  return {
    id: overrides.id ?? makeTenantId(),
    name: overrides.name ?? "Test Tenant",
    taxId: overrides.taxId ?? "0000000000000",
    isOnboardingComplete: overrides.isOnboardingComplete ?? false,
    onboardingStep: overrides.onboardingStep ?? 0,
  };
}
