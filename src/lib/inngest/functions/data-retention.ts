import { and, eq, lt } from "drizzle-orm";
import { inngest } from "../client";
import { db } from "@/lib/db";
import { documents, tenants } from "@/lib/db/schema";

export const applyDataRetention = inngest.createFunction(
  { id: "apply-data-retention", retries: 1 },
  { cron: "TZ=Asia/Bangkok 0 2 * * *" },
  async ({ step }) => {
    const allTenants = await step.run("load-tenants", async () => {
      return db
        .select({
          id: tenants.id,
          years: tenants.dataRetentionYears,
        })
        .from(tenants);
    });

    let archivedCount = 0;
    for (const tenant of allTenants) {
      const retentionYears = Number(tenant.years || 7);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - retentionYears);
      const cutoffDate = cutoff.toISOString().slice(0, 10);

      const rows = await step.run(`archive-${tenant.id}`, async () => {
        return db
          .update(documents)
          .set({
            ocrRaw: { archived: true, archivedAt: new Date().toISOString() },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(documents.tenantId, tenant.id),
              lt(documents.documentDate, cutoffDate)
            )
          )
          .returning({ id: documents.id });
      });
      archivedCount += rows.length;
    }

    return { archivedCount };
  }
);

