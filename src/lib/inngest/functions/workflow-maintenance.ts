import { and, eq, lt } from "drizzle-orm";
import { inngest } from "../client";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export const autoExpirePendingApprovals = inngest.createFunction(
  { id: "auto-expire-pending-approvals", retries: 1 },
  { cron: "TZ=Asia/Bangkok 0 */6 * * *" },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const rows = await step.run("expire-stale-pending", async () => {
      return db
        .update(documents)
        .set({
          status: "ACTION_REQUIRED",
          rejectionComment: "Auto-expired from pending approval queue",
          updatedAt: new Date(),
        })
        .where(and(eq(documents.status, "PENDING_APPROVAL"), lt(documents.updatedAt, cutoff)))
        .returning({ id: documents.id });
    });
    return { expiredCount: rows.length };
  }
);

