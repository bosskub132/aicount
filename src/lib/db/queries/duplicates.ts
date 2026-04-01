import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiDuplicateCandidates, documents } from "@/lib/db/schema";
import type {
  DuplicateCandidate,
  DuplicateOutcome,
} from "@/lib/services/suggestions/types";

export async function insertDuplicateCandidate(
  tenantId: string,
  documentId: string,
  matchDocumentId: string,
  matchType: "file_hash" | "content_match",
  matchScore: number,
  matchDetails?: Record<string, unknown>
): Promise<void> {
  await db.insert(aiDuplicateCandidates).values({
    tenantId,
    documentId,
    matchDocumentId,
    matchType,
    matchScore: String(matchScore),
    matchDetails: matchDetails ?? null,
  });
}

export async function findByFileHash(
  tenantId: string,
  fileHash: string,
  excludeDocumentId: string
): Promise<{ id: string }[]> {
  return db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.fileHash, fileHash),
        ne(documents.id, excludeDocumentId)
      )
    )
    .limit(5);
}

export async function findContentMatches(
  tenantId: string,
  documentId: string,
  issuerTaxId: string,
  grandTotal: number,
  documentDate: string
): Promise<{ id: string; issuerName: string | null; documentNumber: string | null; documentDate: string | null; grandTotal: string | null; status: string }[]> {
  const amountLow = grandTotal * 0.95;
  const amountHigh = grandTotal * 1.05;
  const dateObj = new Date(documentDate);
  const dateLow = new Date(dateObj.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateHigh = new Date(dateObj.getTime() + 30 * 24 * 60 * 60 * 1000);

  return db
    .select({
      id: documents.id,
      issuerName: documents.issuerName,
      documentNumber: documents.documentNumber,
      documentDate: documents.documentDate,
      grandTotal: documents.grandTotal,
      status: documents.status,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        ne(documents.id, documentId),
        eq(documents.issuerTaxId, issuerTaxId),
        gte(documents.grandTotal, String(amountLow)),
        lte(documents.grandTotal, String(amountHigh)),
        gte(documents.documentDate, dateLow.toISOString().slice(0, 10)),
        lte(documents.documentDate, dateHigh.toISOString().slice(0, 10))
      )
    )
    .limit(10);
}

export async function getPendingDuplicates(
  documentId: string
): Promise<DuplicateCandidate[]> {
  const rows = await db
    .select({
      id: aiDuplicateCandidates.id,
      tenantId: aiDuplicateCandidates.tenantId,
      documentId: aiDuplicateCandidates.documentId,
      matchDocumentId: aiDuplicateCandidates.matchDocumentId,
      matchType: aiDuplicateCandidates.matchType,
      matchScore: aiDuplicateCandidates.matchScore,
      matchDetails: aiDuplicateCandidates.matchDetails,
      status: aiDuplicateCandidates.status,
      createdAt: aiDuplicateCandidates.createdAt,
      matchIssuerName: documents.issuerName,
      matchDocNumber: documents.documentNumber,
      matchDocDate: documents.documentDate,
      matchGrandTotal: documents.grandTotal,
      matchStatus: documents.status,
    })
    .from(aiDuplicateCandidates)
    .innerJoin(
      documents,
      eq(aiDuplicateCandidates.matchDocumentId, documents.id)
    )
    .where(
      and(
        eq(aiDuplicateCandidates.documentId, documentId),
        eq(aiDuplicateCandidates.status, "pending")
      )
    );

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    documentId: r.documentId,
    matchDocumentId: r.matchDocumentId,
    matchType: r.matchType as DuplicateCandidate["matchType"],
    matchScore: Number(r.matchScore),
    matchDetails: r.matchDetails as Record<string, unknown> | null,
    status: r.status as DuplicateCandidate["status"],
    createdAt: r.createdAt,
    matchDocument: {
      issuerName: r.matchIssuerName,
      documentNumber: r.matchDocNumber,
      documentDate: r.matchDocDate,
      grandTotal: r.matchGrandTotal,
      status: r.matchStatus,
    },
  }));
}

export async function resolveDuplicates(
  outcomes: DuplicateOutcome[]
): Promise<void> {
  for (const outcome of outcomes) {
    await db
      .update(aiDuplicateCandidates)
      .set({ status: outcome.status })
      .where(eq(aiDuplicateCandidates.id, outcome.id));
  }
}
