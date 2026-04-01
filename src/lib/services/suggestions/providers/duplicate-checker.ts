import { createHash } from "crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
  findByFileHash,
  findContentMatches,
  insertDuplicateCandidate,
} from "@/lib/db/queries/duplicates";
import type { SuggestionResult } from "../types";

/**
 * Computes SHA-256 hash of a file buffer.
 */
export function computeFileHash(fileBuffer: Buffer): string {
  return createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * Checks if any other documents in the tenant share the same file hash.
 * Inserts matches into ai_duplicate_candidates. Returns empty array (side-effect only).
 */
export async function checkFileHash(
  tenantId: string,
  documentId: string,
  fileHash: string
): Promise<SuggestionResult[]> {
  const matches = await findByFileHash(tenantId, fileHash, documentId);

  for (const match of matches) {
    await insertDuplicateCandidate(
      tenantId,
      documentId,
      match.id,
      "file_hash",
      1.0,
      { fileHash }
    );
  }

  return [];
}

/**
 * Finds documents with the same vendor (issuerTaxId), amount within ±5%,
 * and date within ±30 days. Inserts matches into ai_duplicate_candidates.
 * Returns empty array (duplicates go to separate table).
 */
export async function contentMatch(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const [currentDoc] = await db
    .select({
      issuerTaxId: documents.issuerTaxId,
      grandTotal: documents.grandTotal,
      documentDate: documents.documentDate,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.tenantId, tenantId),
        isNotNull(documents.issuerTaxId),
        isNotNull(documents.grandTotal),
        isNotNull(documents.documentDate)
      )
    )
    .limit(1);

  if (
    !currentDoc?.issuerTaxId ||
    !currentDoc.grandTotal ||
    !currentDoc.documentDate
  ) {
    return [];
  }

  const matches = await findContentMatches(
    tenantId,
    documentId,
    currentDoc.issuerTaxId,
    Number(currentDoc.grandTotal),
    currentDoc.documentDate
  );

  for (const match of matches) {
    const amountDiff =
      Math.abs(Number(match.grandTotal) - Number(currentDoc.grandTotal)) /
      Math.max(Number(currentDoc.grandTotal), 1);
    const matchScore = Math.max(0, 1 - amountDiff * 2); // Higher score = closer amount

    await insertDuplicateCandidate(
      tenantId,
      documentId,
      match.id,
      "content_match",
      matchScore,
      {
        issuerTaxId: currentDoc.issuerTaxId,
        grandTotal: currentDoc.grandTotal,
        documentDate: currentDoc.documentDate,
        matchIssuerName: match.issuerName,
        matchDocumentNumber: match.documentNumber,
        matchGrandTotal: match.grandTotal,
        matchDocumentDate: match.documentDate,
      }
    );
  }

  return [];
}
