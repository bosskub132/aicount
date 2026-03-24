import {
  and,
  eq,
  sql,
  desc,
  isNull,
  isNotNull,
  ilike,
  or,
  notExists,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { whtCertificates, documents, vendors } from "@/lib/db/schema";

// ── Types ───────────────────────────────────────────────────────────────────

type WhtCertificateRow = typeof whtCertificates.$inferSelect;

export interface ListCertificatesFilters {
  period?: string; // YYYY-MM
  search?: string;
  status?: "active" | "voided" | "all";
  page?: number;
  limit?: number;
}

export interface ListCertificatesResult {
  rows: WhtCertificateRow[];
  total: number;
}

export interface CertificateStats {
  totalCount: number;
  totalWhtAmount: number;
  activeCount: number;
  voidedCount: number;
}

export interface UncertifiedDocument {
  id: string;
  documentNumber: string | null;
  documentDate: string | null;
  issuerName: string | null;
  issuerTaxId: string | null;
  grandTotal: number;
  whtAmount: number;
  whtRate: number;
  whtIncomeType: string | null;
  vendorId: string | null;
  vendorName: string | null;
  vendorType: string | null;
  vendorBranch: string | null;
}

export interface InsertCertificateData {
  tenantId: string;
  certificateNo: string;
  documentId: string;
  paymentId?: string | null;
  vendorId?: string | null;
  formType: string;
  payeeName: string;
  payeeTaxId: string;
  payeeBranch?: string;
  payeeAddress?: string | null;
  payerName: string;
  payerTaxId: string;
  payerAddress?: string | null;
  payerBranch?: string;
  incomeType: string;
  incomeSection: string;
  paymentDate: string;
  amountPaid: string;
  whtRate: string;
  whtAmount: string;
  pdfStoragePath?: string | null;
  pdfSizeBytes?: number | null;
  issuedBy?: string | null;
  replacesId?: string | null;
  expiresAt?: Date | null;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * List WHT certificates for a tenant with filtering, search, and pagination.
 */
export async function listCertificates(
  tenantId: string,
  filters: ListCertificatesFilters = {},
): Promise<ListCertificatesResult> {
  const {
    period,
    search,
    status = "all",
    page = 1,
    limit = 20,
  } = filters;

  const conditions = [
    eq(whtCertificates.tenantId, tenantId),
    isNull(whtCertificates.deletedAt),
  ];

  // Status filter
  if (status === "active") {
    conditions.push(isNull(whtCertificates.voidedAt));
  } else if (status === "voided") {
    conditions.push(isNotNull(whtCertificates.voidedAt));
  }

  // Period filter on issuedAt
  if (period) {
    const [year, month] = period.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    conditions.push(
      sql`${whtCertificates.issuedAt} >= ${startDate.toISOString()}`,
    );
    conditions.push(
      sql`${whtCertificates.issuedAt} < ${endDate.toISOString()}`,
    );
  }

  // Search filter (ILIKE on certificateNo, payeeName, payeeTaxId)
  if (search && search.trim().length > 0) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(whtCertificates.certificateNo, pattern),
        ilike(whtCertificates.payeeName, pattern),
        ilike(whtCertificates.payeeTaxId, pattern),
      )!,
    );
  }

  const whereClause = and(...conditions);
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(whtCertificates)
      .where(whereClause)
      .orderBy(desc(whtCertificates.issuedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(whtCertificates)
      .where(whereClause),
  ]);

  return {
    rows,
    total: countResult[0]?.count ?? 0,
  };
}

/**
 * Get a single WHT certificate by ID, scoped to tenant.
 */
export async function getCertificate(
  tenantId: string,
  certId: string,
): Promise<WhtCertificateRow | null> {
  const [row] = await db
    .select()
    .from(whtCertificates)
    .where(
      and(
        eq(whtCertificates.id, certId),
        eq(whtCertificates.tenantId, tenantId),
        isNull(whtCertificates.deletedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Get aggregate stats for WHT certificates in a given period.
 */
export async function getCertificateStats(
  tenantId: string,
  period: string,
): Promise<CertificateStats> {
  const [year, month] = period.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const periodConditions = and(
    eq(whtCertificates.tenantId, tenantId),
    isNull(whtCertificates.deletedAt),
    sql`${whtCertificates.issuedAt} >= ${startDate.toISOString()}`,
    sql`${whtCertificates.issuedAt} < ${endDate.toISOString()}`,
  );

  const [result] = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      totalWhtAmount: sql<string>`coalesce(sum(${whtCertificates.whtAmount}), 0)`,
      activeCount: sql<number>`count(*) filter (where ${whtCertificates.voidedAt} is null)::int`,
      voidedCount: sql<number>`count(*) filter (where ${whtCertificates.voidedAt} is not null)::int`,
    })
    .from(whtCertificates)
    .where(periodConditions);

  return {
    totalCount: result?.totalCount ?? 0,
    totalWhtAmount: Number(result?.totalWhtAmount ?? 0),
    activeCount: result?.activeCount ?? 0,
    voidedCount: result?.voidedCount ?? 0,
  };
}

/**
 * List approved documents with WHT amounts that do not yet have
 * an active (non-voided, non-deleted) WHT certificate.
 */
export async function listUncertifiedDocuments(
  tenantId: string,
  period: string,
): Promise<UncertifiedDocument[]> {
  const [year, month] = period.split("-").map(Number);
  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  // Subquery: active certificates for the document
  const activeCertSubquery = db
    .select({ _: sql`1` })
    .from(whtCertificates)
    .where(
      and(
        eq(whtCertificates.documentId, documents.id),
        eq(whtCertificates.tenantId, tenantId),
        isNull(whtCertificates.voidedAt),
        isNull(whtCertificates.deletedAt),
      ),
    );

  const rows = await db
    .select({
      id: documents.id,
      documentNumber: documents.documentNumber,
      documentDate: documents.documentDate,
      issuerName: documents.issuerName,
      issuerTaxId: documents.issuerTaxId,
      grandTotal: documents.grandTotal,
      whtAmount: documents.whtAmount,
      whtRate: documents.whtRate,
      whtIncomeType: documents.whtIncomeType,
      vendorId: vendors.id,
      vendorName: vendors.name,
      vendorType: vendors.vendorType,
      vendorBranch: vendors.branchNumber,
    })
    .from(documents)
    .leftJoin(
      vendors,
      and(
        eq(vendors.taxId, documents.issuerTaxId!),
        eq(vendors.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.status, "APPROVED"),
        isNull(documents.deletedAt),
        sql`${documents.whtAmount} > 0`,
        sql`${documents.documentDate} >= ${startOfMonth}`,
        sql`${documents.documentDate} < ${endOfMonth}`,
        notExists(activeCertSubquery),
      ),
    )
    .orderBy(desc(documents.documentDate));

  return rows.map((r) => ({
    id: r.id,
    documentNumber: r.documentNumber,
    documentDate: r.documentDate,
    issuerName: r.issuerName,
    issuerTaxId: r.issuerTaxId,
    grandTotal: Number(r.grandTotal ?? 0),
    whtAmount: Number(r.whtAmount ?? 0),
    whtRate: Number(r.whtRate ?? 0),
    whtIncomeType: r.whtIncomeType,
    vendorId: r.vendorId,
    vendorName: r.vendorName,
    vendorType: r.vendorType,
    vendorBranch: r.vendorBranch,
  }));
}

/**
 * Insert a new WHT certificate and return the created row.
 */
export async function insertCertificate(
  data: InsertCertificateData,
): Promise<WhtCertificateRow> {
  const [row] = await db
    .insert(whtCertificates)
    .values({
      tenantId: data.tenantId,
      certificateNo: data.certificateNo,
      documentId: data.documentId,
      paymentId: data.paymentId ?? null,
      vendorId: data.vendorId ?? null,
      formType: data.formType,
      payeeName: data.payeeName,
      payeeTaxId: data.payeeTaxId,
      payeeBranch: data.payeeBranch ?? "00000",
      payeeAddress: data.payeeAddress ?? null,
      payerName: data.payerName,
      payerTaxId: data.payerTaxId,
      payerAddress: data.payerAddress ?? null,
      payerBranch: data.payerBranch ?? "00000",
      incomeType: data.incomeType,
      incomeSection: data.incomeSection,
      paymentDate: data.paymentDate,
      amountPaid: data.amountPaid,
      whtRate: data.whtRate,
      whtAmount: data.whtAmount,
      pdfStoragePath: data.pdfStoragePath ?? null,
      pdfSizeBytes: data.pdfSizeBytes ?? null,
      issuedBy: data.issuedBy ?? null,
      replacesId: data.replacesId ?? null,
      expiresAt: data.expiresAt ?? null,
    })
    .returning();

  return row;
}

/**
 * Void a WHT certificate by setting voided_at, voided_by, and void_reason.
 * Only voids if the certificate is not already voided.
 * Returns the updated row or null if not found / already voided.
 */
export async function updateCertificateVoid(
  tenantId: string,
  certId: string,
  reason: string,
  userId: string,
): Promise<WhtCertificateRow | null> {
  const [row] = await db
    .update(whtCertificates)
    .set({
      voidedAt: new Date(),
      voidedBy: userId,
      voidReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(whtCertificates.id, certId),
        eq(whtCertificates.tenantId, tenantId),
        isNull(whtCertificates.voidedAt),
        isNull(whtCertificates.deletedAt),
      ),
    )
    .returning();

  return row ?? null;
}

/**
 * Check if an active (non-voided, non-deleted) certificate already exists
 * for a given document within a tenant.
 * Returns the certificate if found, null otherwise.
 */
export async function checkDuplicate(
  tenantId: string,
  documentId: string,
): Promise<WhtCertificateRow | null> {
  const [row] = await db
    .select()
    .from(whtCertificates)
    .where(
      and(
        eq(whtCertificates.tenantId, tenantId),
        eq(whtCertificates.documentId, documentId),
        isNull(whtCertificates.voidedAt),
        isNull(whtCertificates.deletedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}
