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
