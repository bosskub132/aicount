/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, journalLines } from "@/lib/db/schema";

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "OCR_PROCESSING",
  "ACTION_REQUIRED",
  "QUERY",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXPORTED",
  "REJECTED",
  "VOID",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const SORT_FIELDS = {
  createdAt: documents.createdAt,
  issuerName: documents.issuerName as any,
  grandTotal: documents.grandTotal as any,
  documentDate: documents.documentDate as any,
  status: documents.status as any,
} as const;

export type ListDocumentsParams = {
  page?: number;
  limit?: number;
  statuses?: DocumentStatus[];
  search?: string;
  sort?: keyof typeof SORT_FIELDS;
  order?: "asc" | "desc";
};

export type DocumentListItem = {
  id: string;
  tenantId: string;
  status: string;
  docType: string | null;
  direction: string | null;
  issuerName: string | null;
  issuerTaxId: string | null;
  issuerBranch: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  subtotal: string | null;
  vatAmount: string | null;
  grandTotal: string | null;
  whtAmount: string | null;
  whtRate: string | null;
  whtIncomeType: string | null;
  discountAmount: string | null;
  fileUrl: string | null;
  fileHash: string | null;
  intakeSource: string | null;
  batchId: string | null;
  parentDocumentId: string | null;
  uploadedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListDocumentsResult = {
  data: DocumentListItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export async function listDocuments(
  tenantId: string,
  params: ListDocumentsParams = {}
): Promise<ListDocumentsResult> {
  if (params.statuses && params.statuses.length > 0) {
    for (const s of params.statuses) {
      if (!(DOCUMENT_STATUSES as readonly string[]).includes(s)) {
        throw new Error(`invalid status: ${s}`);
      }
    }
  }

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const search = (params.search ?? "").slice(0, 200).trim() || undefined;
  const sort = params.sort ?? "createdAt";
  const order = params.order === "asc" ? "asc" : "desc";

  const conditions = [eq(documents.tenantId, tenantId)];
  if (params.statuses && params.statuses.length === 1) {
    conditions.push(eq(documents.status, params.statuses[0] as any));
  } else if (params.statuses && params.statuses.length > 1) {
    conditions.push(inArray(documents.status, params.statuses as any));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(documents.issuerName, pattern),
        ilike(documents.documentNumber, pattern)
      ) as any
    );
  }

  const where = and(...conditions);
  const sortColumn = SORT_FIELDS[sort] ?? documents.createdAt;
  const orderBy = order === "asc" ? asc(sortColumn) : desc(sortColumn);
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: documents.id,
        tenantId: documents.tenantId,
        status: documents.status,
        docType: documents.docType,
        direction: documents.direction,
        issuerName: documents.issuerName,
        issuerTaxId: documents.issuerTaxId,
        issuerBranch: documents.issuerBranch,
        documentNumber: documents.documentNumber,
        documentDate: documents.documentDate,
        subtotal: documents.subtotal,
        vatAmount: documents.vatAmount,
        grandTotal: documents.grandTotal,
        whtAmount: documents.whtAmount,
        whtRate: documents.whtRate,
        whtIncomeType: documents.whtIncomeType,
        discountAmount: documents.discountAmount,
        fileUrl: documents.fileUrl,
        fileHash: documents.fileHash,
        intakeSource: documents.intakeSource,
        batchId: documents.batchId,
        parentDocumentId: documents.parentDocumentId,
        uploadedBy: documents.uploadedBy,
        approvedBy: documents.approvedBy,
        approvedAt: documents.approvedAt,
        voidReason: documents.voidReason,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(documents)
      .where(where),
  ]);

  const data: DocumentListItem[] = (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    tenantId: String(r.tenantId),
    status: String(r.status),
    docType: (r.docType as string | null) ?? null,
    direction: (r.direction as string | null) ?? null,
    issuerName: (r.issuerName as string | null) ?? null,
    issuerTaxId: (r.issuerTaxId as string | null) ?? null,
    issuerBranch: (r.issuerBranch as string | null) ?? null,
    documentNumber: (r.documentNumber as string | null) ?? null,
    documentDate: toIso(r.documentDate),
    subtotal: (r.subtotal as string | null) ?? null,
    vatAmount: (r.vatAmount as string | null) ?? null,
    grandTotal: (r.grandTotal as string | null) ?? null,
    whtAmount: (r.whtAmount as string | null) ?? null,
    whtRate: (r.whtRate as string | null) ?? null,
    whtIncomeType: (r.whtIncomeType as string | null) ?? null,
    discountAmount: (r.discountAmount as string | null) ?? null,
    fileUrl: (r.fileUrl as string | null) ?? null,
    fileHash: (r.fileHash as string | null) ?? null,
    intakeSource: (r.intakeSource as string | null) ?? null,
    batchId: (r.batchId as string | null) ?? null,
    parentDocumentId: (r.parentDocumentId as string | null) ?? null,
    uploadedBy: (r.uploadedBy as string | null) ?? null,
    approvedBy: (r.approvedBy as string | null) ?? null,
    approvedAt: toIso(r.approvedAt),
    voidReason: (r.voidReason as string | null) ?? null,
    createdAt: toIso(r.createdAt) ?? "",
    updatedAt: toIso(r.updatedAt) ?? "",
  }));

  const total = Number(countResult[0]?.total ?? 0);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getDocumentById(id: string, tenantId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
    .limit(1);
  return doc ?? null;
}

export async function getDocumentWithLines(id: string, tenantId: string) {
  const doc = await getDocumentById(id, tenantId);
  if (!doc) return null;

  const lines = await db.select().from(journalLines).where(eq(journalLines.documentId, id));
  return { ...doc, journalLines: lines };
}

export async function replaceJournalLines(
  documentId: string,
  lines: Array<{
    accountCode: string;
    deptCode?: string | null;
    debit: number;
    credit: number;
    description?: string | null;
  }>
) {
  await db.delete(journalLines).where(eq(journalLines.documentId, documentId));

  if (!lines.length) return;
  await db.insert(journalLines).values(
    lines.map((line, index) => ({
      documentId,
      accountCode: line.accountCode,
      deptCode: line.deptCode || null,
      debit: Number(line.debit).toFixed(2),
      credit: Number(line.credit).toFixed(2),
      description: line.description || null,
      sortOrder: index,
    }))
  );
}

export async function markDocumentsApproved(ids: string[], approverId: string) {
  if (!ids.length) return;
  await db
    .update(documents)
    .set({
      status: "APPROVED",
      approvedBy: approverId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(documents.id, ids));
}

