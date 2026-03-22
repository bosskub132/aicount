import {
  and,
  eq,
  sql,
  desc,
  isNull,
} from "drizzle-orm";
import {
  documents,
  payments,
  journalEntries,
  journalLines,
  periodLocks,
} from "@/lib/db/schema";
import { generateJvNumber } from "@/lib/services/jv-number";

// ── Types ───────────────────────────────────────────────────────────────────

type Db = typeof import("@/lib/db").db;

type PaymentRow = typeof payments.$inferSelect;
type JournalEntryRow = typeof journalEntries.$inferSelect;

export interface RecordPaymentData {
  documentId: string;
  amount: number;
  whtAmount?: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNo?: string;
  notes?: string;
  createdBy: string;
}

export interface RecordPaymentResult {
  payment: PaymentRow;
  journalEntry: JournalEntryRow;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Record a payment against a document and create an offsetting journal entry.
 *
 * Steps:
 *   1. Validate period is not locked for paymentDate
 *   2. Validate amount <= remaining (grandTotal - existing payments)
 *   3. Calculate netAmount = amount - (whtAmount || 0)
 *   4. Create payment record
 *   5. Create offsetting journal entry with lines
 *   6. Link payment to journal entry
 */
export async function recordPayment(
  db: Db,
  tenantId: string,
  data: RecordPaymentData,
): Promise<RecordPaymentResult> {
  return await db.transaction(async (tx) => {
    // 1. Validate period is not locked
    const yearMonth = data.paymentDate.substring(0, 7); // "YYYY-MM"
    const [lock] = await tx
      .select()
      .from(periodLocks)
      .where(
        and(
          eq(periodLocks.tenantId, tenantId),
          eq(periodLocks.yearMonth, yearMonth),
        ),
      )
      .limit(1);

    if (lock) {
      throw new Error(`Period ${yearMonth} is locked`);
    }

    // Fetch the document
    const [doc] = await tx
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, data.documentId),
          eq(documents.tenantId, tenantId),
          isNull(documents.deletedAt),
        ),
      )
      .limit(1);

    if (!doc) {
      throw new Error("Document not found");
    }

    // 2. Validate amount <= remaining
    const [existingSum] = await tx
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.documentId, data.documentId),
          eq(payments.tenantId, tenantId),
        ),
      );

    const grandTotal = Number(doc.grandTotal ?? 0);
    const alreadyPaid = Number(existingSum?.total ?? 0);
    const remaining = grandTotal - alreadyPaid;

    if (data.amount > remaining) {
      throw new Error(
        `Payment amount (${data.amount}) exceeds remaining balance (${remaining})`,
      );
    }

    if (data.amount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    // 3. Calculate netAmount
    const whtAmount = data.whtAmount ?? 0;
    const netAmount = data.amount - whtAmount;

    if (netAmount < 0) {
      throw new Error("WHT amount cannot exceed payment amount");
    }

    // 4. Generate JV number and create journal entry
    const jvNumber = await generateJvNumber(tx, tenantId);

    const isAR = doc.direction === "REVENUE";
    const jeType = isAR ? "RV" as const : "PV" as const;
    const description = isAR
      ? `Collection for ${doc.documentNumber ?? doc.id}`
      : `Payment for ${doc.documentNumber ?? doc.id}`;

    const [journalEntry] = await tx
      .insert(journalEntries)
      .values({
        tenantId,
        jvNumber,
        date: data.paymentDate,
        type: jeType,
        description,
        status: "posted",
        sourceDocumentId: data.documentId,
        createdBy: data.createdBy,
      })
      .returning();

    // 5. Create journal lines
    // For AR (REVENUE): debit Cash/Bank, credit Accounts Receivable
    // For AP (EXPENSE): debit Accounts Payable, credit Cash/Bank
    //   If WHT > 0 on AP: additional line for WHT Payable
    const lines: Array<{
      journalEntryId: string;
      accountCode: string;
      debit: string;
      credit: string;
      description: string | null;
      sortOrder: number;
    }> = [];

    if (isAR) {
      // Debit Cash/Bank
      lines.push({
        journalEntryId: journalEntry.id,
        accountCode: "1102", // Cash/Bank
        debit: netAmount.toFixed(2),
        credit: "0.00",
        description: `Cash received - ${data.paymentMethod ?? ""}`.trim(),
        sortOrder: 0,
      });

      if (whtAmount > 0) {
        // Debit WHT Receivable (customer withheld tax)
        lines.push({
          journalEntryId: journalEntry.id,
          accountCode: "1140", // WHT Receivable
          debit: whtAmount.toFixed(2),
          credit: "0.00",
          description: "WHT withheld by customer",
          sortOrder: 1,
        });
      }

      // Credit Accounts Receivable
      lines.push({
        journalEntryId: journalEntry.id,
        accountCode: "1130", // Accounts Receivable
        debit: "0.00",
        credit: data.amount.toFixed(2),
        description: `AR collection - ${doc.documentNumber ?? ""}`.trim(),
        sortOrder: whtAmount > 0 ? 2 : 1,
      });
    } else {
      // AP: Debit Accounts Payable
      lines.push({
        journalEntryId: journalEntry.id,
        accountCode: "2110", // Accounts Payable
        debit: data.amount.toFixed(2),
        credit: "0.00",
        description: `AP payment - ${doc.documentNumber ?? ""}`.trim(),
        sortOrder: 0,
      });

      // Credit Cash/Bank
      lines.push({
        journalEntryId: journalEntry.id,
        accountCode: "1102", // Cash/Bank
        debit: "0.00",
        credit: netAmount.toFixed(2),
        description: `Cash paid - ${data.paymentMethod ?? ""}`.trim(),
        sortOrder: 1,
      });

      if (whtAmount > 0) {
        // Credit WHT Payable
        lines.push({
          journalEntryId: journalEntry.id,
          accountCode: "2140", // WHT Payable
          debit: "0.00",
          credit: whtAmount.toFixed(2),
          description: "WHT withheld",
          sortOrder: 2,
        });
      }
    }

    await tx.insert(journalLines).values(lines);

    // 6. Create payment record linked to journal entry
    const [payment] = await tx
      .insert(payments)
      .values({
        tenantId,
        documentId: data.documentId,
        journalEntryId: journalEntry.id,
        amount: data.amount.toFixed(2),
        whtAmount: whtAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        referenceNo: data.referenceNo ?? null,
        notes: data.notes ?? null,
        createdBy: data.createdBy,
      })
      .returning();

    return { payment, journalEntry };
  });
}

/**
 * Get all payments for a specific document, ordered by date descending.
 */
export async function getPaymentsForDocument(
  db: Db,
  tenantId: string,
  documentId: string,
): Promise<PaymentRow[]> {
  return await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(payments.documentId, documentId),
      ),
    )
    .orderBy(desc(payments.createdAt));
}

/**
 * Get total paid amount for a specific document.
 */
export async function getPaymentSum(
  db: Db,
  tenantId: string,
  documentId: string,
): Promise<number> {
  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(payments.documentId, documentId),
      ),
    );

  return Number(result?.total ?? 0);
}
