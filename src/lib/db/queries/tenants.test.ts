import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeUserId, makeTenantRow } from "@/lib/test/fixtures";

const state = vi.hoisted(() => ({
  insertCalls: [] as Array<{ table: string; values: unknown }>,
  returnedTenant: null as Record<string, unknown> | null,
  throwOnAssignmentsInsert: false,
  updateSetValues: null as Record<string, unknown> | null,
  updateReturnRows: [] as Record<string, unknown>[],
  selectQueue: [] as unknown[][],
  selectCalls: 0,
  sqlFragments: [] as string[],
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
      const rendered = strings.reduce(
        (acc, part, i) => acc + part + (values[i] !== undefined ? String(values[i]) : ""),
        ""
      );
      state.sqlFragments.push(rendered);
      return { _rendered: rendered };
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: (table: { _: { name: string } }) => ({
          values: (values: unknown) => ({
            returning: async () => {
              state.insertCalls.push({ table: table._.name, values });
              if (table._.name === "tenants") {
                return [state.returnedTenant];
              }
              if (table._.name === "tenant_assignments" && state.throwOnAssignmentsInsert) {
                throw new Error("assignment insert failed");
              }
              return [];
            },
          }),
        }),
      };
      return fn(tx);
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        state.updateSetValues = values;
        return {
          where: () => ({ returning: async () => state.updateReturnRows }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({ limit: async () => state.selectQueue[state.selectCalls++] ?? [] }),
            limit: async () => state.selectQueue[state.selectCalls++] ?? [],
          }),
          limit: async () => state.selectQueue[state.selectCalls++] ?? [],
        }),
        where: () => ({
          orderBy: () => ({ limit: async () => state.selectQueue[state.selectCalls++] ?? [] }),
          limit: async () => state.selectQueue[state.selectCalls++] ?? [],
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  tenants: { _: { name: "tenants" }, id: "tenants.id", onboardingStep: "tenants.onboarding_step" },
  tenantAssignments: {
    _: { name: "tenant_assignments" },
    userId: "ta.user_id",
    tenantId: "ta.tenant_id",
    createdAt: "ta.created_at",
  },
  profiles: { id: "profiles.id", defaultTenantId: "profiles.default_tenant_id" },
}));

const queries = await import("./tenants");

describe("createTenantWithOwner", () => {
  beforeEach(() => {
    state.insertCalls = [];
    state.returnedTenant = null;
    state.throwOnAssignmentsInsert = false;
  });

  it("inserts tenant then two assignment rows (maker + checker)", async () => {
    const userId = makeUserId();
    const tenantRow = makeTenantRow();
    state.returnedTenant = tenantRow;

    const result = await queries.createTenantWithOwner({
      ownerUserId: userId,
      name: "ACME",
      taxId: "1234567890123",
      industry: "retail",
      companySize: "small",
    });

    expect(result).toEqual(tenantRow);
    expect(state.insertCalls).toHaveLength(2);
    expect(state.insertCalls[0].table).toBe("tenants");
    expect(state.insertCalls[1].table).toBe("tenant_assignments");
    expect(state.insertCalls[1].values).toEqual([
      { tenantId: tenantRow.id, userId, role: "maker" },
      { tenantId: tenantRow.id, userId, role: "checker" },
    ]);
  });

  it("rolls back if assignment insert fails", async () => {
    state.returnedTenant = makeTenantRow();
    state.throwOnAssignmentsInsert = true;

    await expect(
      queries.createTenantWithOwner({
        ownerUserId: makeUserId(),
        name: "ACME",
        taxId: "1234567890123",
      })
    ).rejects.toThrow("assignment insert failed");
  });
});

describe("patchTenantOnboarding", () => {
  beforeEach(() => {
    state.sqlFragments = [];
    state.updateSetValues = null;
    state.updateReturnRows = [{ id: "t1", onboardingStep: 5, isOnboardingComplete: false }];
  });

  it("uses GREATEST when advancing onboardingStep", async () => {
    await queries.patchTenantOnboarding({ tenantId: "t1", onboardingStep: 3 });
    const joined = state.sqlFragments.join(" ");
    expect(joined).toContain("GREATEST");
  });

  it("clamps step to [0, 8]", async () => {
    await queries.patchTenantOnboarding({ tenantId: "t1", onboardingStep: 99 });
    const joined = state.sqlFragments.join(" ");
    expect(joined).toMatch(/8/);
  });

  it("accepts isOnboardingComplete updates", async () => {
    await queries.patchTenantOnboarding({ tenantId: "t1", isOnboardingComplete: true });
    expect(state.updateSetValues?.isOnboardingComplete).toBe(true);
  });
});

describe("resolveDefaultTenant", () => {
  beforeEach(() => {
    state.selectQueue = [];
    state.selectCalls = 0;
  });

  it("returns null when user has no assignments and no default", async () => {
    state.selectQueue = [
      [],
      [],
    ];
    const result = await queries.resolveDefaultTenant("user-1");
    expect(result).toBeNull();
  });

  it("returns default_tenant_id when user still has assignment to it", async () => {
    state.selectQueue = [
      [{ defaultTenantId: "t-default", hasAssignment: "t-default" }],
    ];
    const result = await queries.resolveDefaultTenant("user-1");
    expect(result).toBe("t-default");
  });

  it("falls through to oldest assignment when default is stale", async () => {
    state.selectQueue = [
      [{ defaultTenantId: "t-gone", hasAssignment: null }],
      [{ tenantId: "t-oldest" }],
    ];
    const result = await queries.resolveDefaultTenant("user-1");
    expect(result).toBe("t-oldest");
  });
});
