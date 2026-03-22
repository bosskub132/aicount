import { inngest } from "../client";
import { db } from "@/lib/db";
import { tenants, tenantAssignments } from "@/lib/db/schema";
import { lte, isNotNull, and, eq } from "drizzle-orm";

export const workspacePurge = inngest.createFunction(
  { id: "workspace-purge", name: "Purge Expired Workspaces" },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const expiredTenants = await step.run("find-expired-workspaces", async () => {
      return db
        .select({ id: tenants.id, name: tenants.name, ownerUserId: tenants.ownerUserId })
        .from(tenants)
        .where(
          and(
            isNotNull(tenants.deletionScheduledFor),
            lte(tenants.deletionScheduledFor, new Date())
          )
        );
    });

    for (const tenant of expiredTenants) {
      await step.run(`purge-workspace-${tenant.id}`, async () => {
        await db.delete(tenantAssignments).where(eq(tenantAssignments.tenantId, tenant.id));
        await db.delete(tenants).where(eq(tenants.id, tenant.id));
        return { purgedTenantId: tenant.id, name: tenant.name };
      });
    }

    return { purgedCount: expiredTenants.length };
  }
);
