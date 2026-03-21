import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, journalLines } from "@/lib/db/schema";

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

