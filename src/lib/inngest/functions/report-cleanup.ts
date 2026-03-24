import { and, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "../client";
import { db } from "@/lib/db";
import { reportHistory, reportRetentionPolicy } from "@/lib/db/schema";

const BATCH_LIMIT = 100;
const DEFAULT_TRASH_RECOVERY_DAYS = 7;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, key);
}

export const reportCleanup = inngest.createFunction(
  { id: "report-cleanup", name: "Daily Report Cleanup", retries: 1 },
  { cron: "0 19 * * *" },
  async ({ step }) => {
    // Step 1: Move expired reports to trash
    const trashed = await step.run("trash-expired-reports", async () => {
      const now = new Date();
      const expired = await db
        .select({ id: reportHistory.id })
        .from(reportHistory)
        .where(
          and(
            isNull(reportHistory.deletedAt),
            isNotNull(reportHistory.expiresAt),
            lte(reportHistory.expiresAt, now)
          )
        )
        .limit(BATCH_LIMIT);

      if (expired.length === 0) return 0;

      const ids = expired.map((r) => r.id);
      await db
        .update(reportHistory)
        .set({ deletedAt: now, updatedAt: now })
        .where(sql`${reportHistory.id} = ANY(${ids})`);

      console.log(`[report-cleanup] Trashed ${ids.length} expired reports`);
      return ids.length;
    });

    // Step 2: Permanently delete reports past trash recovery period
    const deleted = await step.run("delete-past-recovery", async () => {
      // Get all tenant retention policies
      const policies = await db
        .select({
          tenantId: reportRetentionPolicy.tenantId,
          trashRecoveryDays: reportRetentionPolicy.trashRecoveryDays,
        })
        .from(reportRetentionPolicy);

      const policyMap = new Map(
        policies.map((p) => [p.tenantId, p.trashRecoveryDays])
      );

      // Find all trashed reports
      const trashedReports = await db
        .select({
          id: reportHistory.id,
          tenantId: reportHistory.tenantId,
          deletedAt: reportHistory.deletedAt,
          pdfStoragePath: reportHistory.pdfStoragePath,
        })
        .from(reportHistory)
        .where(isNotNull(reportHistory.deletedAt))
        .limit(BATCH_LIMIT);

      if (trashedReports.length === 0) return 0;

      const now = new Date();
      const toDelete: { id: string; pdfStoragePath: string | null }[] = [];

      for (const report of trashedReports) {
        if (!report.deletedAt) continue;

        const recoveryDays =
          policyMap.get(report.tenantId) ?? DEFAULT_TRASH_RECOVERY_DAYS;
        const cutoff = new Date(report.deletedAt);
        cutoff.setDate(cutoff.getDate() + recoveryDays);

        if (now >= cutoff) {
          toDelete.push({ id: report.id, pdfStoragePath: report.pdfStoragePath });
        }
      }

      if (toDelete.length === 0) return 0;

      // Delete PDFs from Supabase Storage
      const supabase = getSupabaseAdmin();
      const storagePaths = toDelete
        .map((r) => r.pdfStoragePath)
        .filter((p): p is string => Boolean(p));

      if (storagePaths.length > 0) {
        const { error } = await supabase.storage
          .from("report-pdfs")
          .remove(storagePaths);

        if (error) {
          console.error("[report-cleanup] Storage deletion error:", error.message);
        }
      }

      // Delete rows from database
      const deleteIds = toDelete.map((r) => r.id);
      await db
        .delete(reportHistory)
        .where(sql`${reportHistory.id} = ANY(${deleteIds})`);

      console.log(
        `[report-cleanup] Permanently deleted ${deleteIds.length} reports (${storagePaths.length} PDFs removed)`
      );
      return deleteIds.length;
    });

    console.log(
      `[report-cleanup] Complete: trashed=${trashed}, permanentlyDeleted=${deleted}`
    );
    return { trashed, permanentlyDeleted: deleted };
  }
);
