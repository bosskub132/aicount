import {
  and,
  eq,
  isNull,
  isNotNull,
  desc,
  count,
  sql,
  inArray,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { reportHistory } from "@/lib/db/schema";
import { getRetentionPolicy } from "@/lib/db/queries/report-retention";
import { computeExpiresAt } from "@/lib/services/report-retention";
import { REPORT_RETENTION_CATEGORY } from "@/lib/utils/constants";

// ── Types ───────────────────────────────────────────────────────────────────

type ReportHistoryRow = typeof reportHistory.$inferSelect;

export interface ListReportHistoryFilters {
  reportType?: string;
  status?: "locked" | "draft" | "trash" | "all";
  page?: number;
  limit?: number;
}

export interface UpsertReportDraftData {
  reportType: string;
  period: string;
  periodScope: string;
  dateFrom: string;
  dateTo: string;
  filters?: unknown;
  pdfStoragePath?: string;
  pdfSizeBytes?: number;
  generatedBy?: string;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function listReportHistory(
  tenantId: string,
  filters: ListReportHistoryFilters = {}
): Promise<{ rows: ReportHistoryRow[]; total: number }> {
  const { reportType, status = "all", page = 1, limit = 20 } = filters;

  const conditions = [eq(reportHistory.tenantId, tenantId)];

  if (reportType) {
    conditions.push(eq(reportHistory.reportType, reportType));
  }

  // Status filtering — always exclude permanently deleted
  switch (status) {
    case "locked":
      conditions.push(isNotNull(reportHistory.lockedAt));
      conditions.push(isNull(reportHistory.deletedAt));
      break;
    case "draft":
      conditions.push(isNull(reportHistory.lockedAt));
      conditions.push(isNull(reportHistory.deletedAt));
      break;
    case "trash":
      conditions.push(isNotNull(reportHistory.deletedAt));
      break;
    case "all":
    default:
      conditions.push(isNull(reportHistory.deletedAt));
      break;
  }

  const whereClause = and(...conditions);

  const [countResult] = await db
    .select({ total: count() })
    .from(reportHistory)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  const rows = await db
    .select()
    .from(reportHistory)
    .where(whereClause)
    .orderBy(desc(reportHistory.createdAt))
    .limit(limit)
    .offset(offset);

  return { rows, total };
}

export async function getReportHistory(
  tenantId: string,
  reportId: string
): Promise<ReportHistoryRow | null> {
  const [row] = await db
    .select()
    .from(reportHistory)
    .where(
      and(eq(reportHistory.id, reportId), eq(reportHistory.tenantId, tenantId))
    )
    .limit(1);

  return row ?? null;
}

export async function upsertReportDraft(
  tenantId: string,
  data: UpsertReportDraftData
): Promise<ReportHistoryRow> {
  const now = new Date();

  // Check for existing draft (unique index: tenantId + reportType + period + periodScope where locked_at IS NULL AND deleted_at IS NULL)
  const [existing] = await db
    .select()
    .from(reportHistory)
    .where(
      and(
        eq(reportHistory.tenantId, tenantId),
        eq(reportHistory.reportType, data.reportType),
        eq(reportHistory.period, data.period),
        eq(reportHistory.periodScope, data.periodScope),
        isNull(reportHistory.lockedAt),
        isNull(reportHistory.deletedAt)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(reportHistory)
      .set({
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
        filters: data.filters ?? existing.filters,
        pdfStoragePath: data.pdfStoragePath ?? existing.pdfStoragePath,
        pdfSizeBytes: data.pdfSizeBytes ?? existing.pdfSizeBytes,
        generatedBy: data.generatedBy ?? existing.generatedBy,
        updatedAt: now,
      })
      .where(eq(reportHistory.id, existing.id))
      .returning();

    return updated;
  }

  // Compute expires_at for new draft
  const policy = await getRetentionPolicy(tenantId);
  const expiresAt = computeExpiresAt(data.reportType, false, policy);

  const [inserted] = await db
    .insert(reportHistory)
    .values({
      tenantId,
      reportType: data.reportType,
      period: data.period,
      periodScope: data.periodScope,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      filters: data.filters ?? null,
      pdfStoragePath: data.pdfStoragePath ?? null,
      pdfSizeBytes: data.pdfSizeBytes ?? null,
      generatedBy: data.generatedBy ?? null,
      expiresAt,
      updatedAt: now,
    })
    .returning();

  return inserted;
}

export async function lockReport(
  tenantId: string,
  reportId: string,
  userId: string
): Promise<ReportHistoryRow | null> {
  const existing = await getReportHistory(tenantId, reportId);
  if (!existing) return null;

  const policy = await getRetentionPolicy(tenantId);
  const expiresAt = computeExpiresAt(existing.reportType, true, policy);

  const [updated] = await db
    .update(reportHistory)
    .set({
      lockedAt: new Date(),
      lockedBy: userId,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(eq(reportHistory.id, reportId), eq(reportHistory.tenantId, tenantId))
    )
    .returning();

  return updated ?? null;
}

export async function unlockReport(
  tenantId: string,
  reportId: string
): Promise<ReportHistoryRow | null> {
  const existing = await getReportHistory(tenantId, reportId);
  if (!existing) return null;

  const policy = await getRetentionPolicy(tenantId);
  const expiresAt = computeExpiresAt(existing.reportType, false, policy);

  const [updated] = await db
    .update(reportHistory)
    .set({
      lockedAt: null,
      lockedBy: null,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(eq(reportHistory.id, reportId), eq(reportHistory.tenantId, tenantId))
    )
    .returning();

  return updated ?? null;
}

export async function softDeleteReport(
  tenantId: string,
  reportId: string
): Promise<ReportHistoryRow | null> {
  const [updated] = await db
    .update(reportHistory)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(reportHistory.id, reportId), eq(reportHistory.tenantId, tenantId))
    )
    .returning();

  return updated ?? null;
}

export async function restoreReport(
  tenantId: string,
  reportId: string
): Promise<ReportHistoryRow | null> {
  const [updated] = await db
    .update(reportHistory)
    .set({
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reportHistory.id, reportId),
        eq(reportHistory.tenantId, tenantId),
        isNotNull(reportHistory.deletedAt)
      )
    )
    .returning();

  return updated ?? null;
}

export async function countAffectedByRetentionChange(
  tenantId: string,
  category: string,
  newExpiresAt: Date
): Promise<number> {
  // Map category to report types
  const reportTypes = Object.entries(REPORT_RETENTION_CATEGORY)
    .filter(([, cat]) => cat === category)
    .map(([type]) => type);

  if (reportTypes.length === 0) return 0;

  const [result] = await db
    .select({ total: count() })
    .from(reportHistory)
    .where(
      and(
        eq(reportHistory.tenantId, tenantId),
        inArray(reportHistory.reportType, reportTypes),
        isNotNull(reportHistory.lockedAt),
        isNull(reportHistory.deletedAt),
        sql`${reportHistory.expiresAt} > ${newExpiresAt}`
      )
    );

  return result?.total ?? 0;
}
