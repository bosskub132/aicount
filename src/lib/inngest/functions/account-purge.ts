import { inngest } from "../client";
import { db } from "@/lib/db";
import { profiles, tenants, tenantAssignments } from "@/lib/db/schema";
import { lte, isNotNull, and, eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

export const accountPurge = inngest.createFunction(
  { id: "account-purge", name: "Purge Expired Accounts" },
  { cron: "0 4 * * *" },
  async ({ step }) => {
    const expiredProfiles = await step.run("find-expired-accounts", async () => {
      return db
        .select({ id: profiles.id, email: profiles.email })
        .from(profiles)
        .where(
          and(
            isNotNull(profiles.deletionScheduledFor),
            lte(profiles.deletionScheduledFor, new Date())
          )
        );
    });

    for (const profile of expiredProfiles) {
      await step.run(`purge-account-${profile.id}`, async () => {
        const ownedTenants = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.ownerUserId, profile.id));

        for (const tenant of ownedTenants) {
          await db.delete(tenantAssignments).where(eq(tenantAssignments.tenantId, tenant.id));
          await db.delete(tenants).where(eq(tenants.id, tenant.id));
        }

        await db.delete(tenantAssignments).where(eq(tenantAssignments.userId, profile.id));
        await db.delete(profiles).where(eq(profiles.id, profile.id));

        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await supabaseAdmin.auth.admin.deleteUser(profile.id);

        return { purgedUserId: profile.id, email: profile.email };
      });
    }

    return { purgedCount: expiredProfiles.length };
  }
);
