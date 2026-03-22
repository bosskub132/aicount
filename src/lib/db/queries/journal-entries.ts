import {
  and,
  eq,
  gte,
  lte,
  sql,
  desc,
  asc,
  count,
  sum,
} from "drizzle-orm";
import {
  journalEntries,
  journalLines,
  periodLocks,
} from "@/lib/db/schema";
import { generateJvNumber } from "@/lib/services/jv-number";

// ── Types ───────────────────────────────────────────────────────────────────

type Db = typeof import("@/lib/db").db;

type JournalLineRow = typeof journalLines.$inferSelect;
type JournalEntryRow = typeof journalEntries.$inferSelect;

export type JournalEntryWithLines = JournalEntryRow & {
  lines: JournalLineRow[];
};

export interface ListJournalEntriesFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: typeof journalEntries.$inferSelect.type;
  status?: typeof journalEntries.$inferSelect.status;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateJournalEntryData {
  date: string;
  type: typeof journalEntries.$inferSelect.type;
  description: string;
  sourceDocumentId?: string;
  createdBy: string;
  lines: Array<{
    accountCode: string;
    deptCode?: string | null;
    debit: number;
    credit: number;
    description?: string | null;
  }>;
}

export interface UpdateJournalEntryData {
  date?: string;
  type?: typeof journalEntries.$inferSelect.type;
  description?: string;
  lines?: Array<{
    accountCode: string;
    deptCode?: string | null;
    debit: number;
    credit: number;
    description?: string | null;
  }>;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function listJournalEntries(
  db: Db,
  tenantId: string,
  filters: ListJournalEntriesFilters = {}
) {
  const { dateFrom, dateTo, type, status, search, page = 1, pageSize = 20 } = filters;

  const conditions = [eq(journalEntries.tenantId, tenantId)];

  if (dateFrom) {
    conditions.push(gte(journalEntries.date, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(journalEntries.date, dateTo));
  }
  if (type) {
    conditions.push(eq(journalEntries.type, type));
  }
  if (status) {
    conditions.push(eq(journalEntries.status, status));
  }
  if (search) {
    conditions.push(
      sql`(${journalEntries.description} ILIKE ${"%" + search + "%"} OR ${journalEntries.jvNumber} ILIKE ${"%" + search + "%"})`
    );
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(journalEntries)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  // Get paginated entries
  const offset = (page - 1) * pageSize;
  const entries = await db
    .select()
    .from(journalEntries)
    .where(whereClause)
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Fetch lines for all entries in a single query
  const entryIds = entries.map((e) => e.id);
  let linesMap: Map<string, JournalLineRow[]> = new Map();

  if (entryIds.length > 0) {
    const allLines = await db
      .select()
      .from(journalLines)
      .where(
        sql`${journalLines.journalEntryId} IN (${sql.join(
          entryIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .orderBy(asc(journalLines.sortOrder));

    for (const line of allLines) {
      const key = line.journalEntryId ?? "";
      if (!linesMap.has(key)) {
        linesMap.set(key, []);
      }
      linesMap.get(key)!.push(line);
    }
  }

  const entriesWithLines: JournalEntryWithLines[] = entries.map((entry) => ({
    ...entry,
    lines: linesMap.get(entry.id) ?? [],
  }));

  return { entries: entriesWithLines, total, page, pageSize };
}

export async function getJournalEntry(
  db: Db,
  tenantId: string,
  entryId: string
): Promise<JournalEntryWithLines | null> {
  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(
      and(eq(journalEntries.id, entryId), eq(journalEntries.tenantId, tenantId))
    )
    .limit(1);

  if (!entry) return null;

  const lines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, entryId))
    .orderBy(asc(journalLines.sortOrder));

  return { ...entry, lines };
}

export async function createJournalEntry(
  db: Db,
  tenantId: string,
  data: CreateJournalEntryData
) {
  return await db.transaction(async (tx) => {
    const jvNumber = await generateJvNumber(tx, tenantId);

    const [entry] = await tx
      .insert(journalEntries)
      .values({
        tenantId,
        jvNumber,
        date: data.date,
        type: data.type,
        description: data.description,
        sourceDocumentId: data.sourceDocumentId ?? null,
        createdBy: data.createdBy,
        status: "draft",
      })
      .returning();

    if (data.lines.length > 0) {
      await tx.insert(journalLines).values(
        data.lines.map((line, index) => ({
          journalEntryId: entry.id,
          accountCode: line.accountCode,
          deptCode: line.deptCode ?? null,
          debit: Number(line.debit).toFixed(2),
          credit: Number(line.credit).toFixed(2),
          description: line.description ?? null,
          sortOrder: index,
        }))
      );
    }

    return { ...entry, jvNumber };
  });
}

export async function updateJournalEntry(
  db: Db,
  tenantId: string,
  entryId: string,
  data: UpdateJournalEntryData
) {
  return await db.transaction(async (tx) => {
    // Fetch existing entry
    const [existing] = await tx
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, entryId),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error("Journal entry not found");
    }

    if (existing.status === "reversed") {
      throw new Error("Cannot update a reversed journal entry");
    }

    // Check period lock
    const entryDate = data.date ?? existing.date;
    const yearMonth = entryDate.substring(0, 7); // "YYYY-MM"
    const [lock] = await tx
      .select()
      .from(periodLocks)
      .where(
        and(
          eq(periodLocks.tenantId, tenantId),
          eq(periodLocks.yearMonth, yearMonth)
        )
      )
      .limit(1);

    if (lock) {
      throw new Error(`Period ${yearMonth} is locked`);
    }

    // Update header
    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.date !== undefined) updateFields.date = data.date;
    if (data.type !== undefined) updateFields.type = data.type;
    if (data.description !== undefined) updateFields.description = data.description;

    const [updated] = await tx
      .update(journalEntries)
      .set(updateFields)
      .where(eq(journalEntries.id, entryId))
      .returning();

    // Replace lines if provided
    if (data.lines !== undefined) {
      await tx
        .delete(journalLines)
        .where(eq(journalLines.journalEntryId, entryId));

      if (data.lines.length > 0) {
        await tx.insert(journalLines).values(
          data.lines.map((line, index) => ({
            journalEntryId: entryId,
            accountCode: line.accountCode,
            deptCode: line.deptCode ?? null,
            debit: Number(line.debit).toFixed(2),
            credit: Number(line.credit).toFixed(2),
            description: line.description ?? null,
            sortOrder: index,
          }))
        );
      }
    }

    return updated;
  });
}

export async function postJournalEntry(
  db: Db,
  tenantId: string,
  entryId: string
) {
  const [existing] = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.id, entryId),
        eq(journalEntries.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new Error("Journal entry not found");
  }

  if (existing.status !== "draft") {
    throw new Error("Only draft entries can be posted");
  }

  const [updated] = await db
    .update(journalEntries)
    .set({ status: "posted", updatedAt: new Date() })
    .where(eq(journalEntries.id, entryId))
    .returning();

  return updated;
}

export async function reverseJournalEntry(
  db: Db,
  tenantId: string,
  entryId: string,
  createdBy: string
) {
  return await db.transaction(async (tx) => {
    // Fetch original entry with lines
    const [original] = await tx
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, entryId),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!original) {
      throw new Error("Journal entry not found");
    }

    if (original.status === "reversed") {
      throw new Error("Entry is already reversed");
    }

    const originalLines = await tx
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, entryId))
      .orderBy(asc(journalLines.sortOrder));

    // Generate new JV number for the reversal
    const jvNumber = await generateJvNumber(tx, tenantId);

    // Create reversal entry
    const [reversalEntry] = await tx
      .insert(journalEntries)
      .values({
        tenantId,
        jvNumber,
        date: original.date,
        type: original.type,
        description: `Reversal of ${original.jvNumber}: ${original.description}`,
        status: "posted",
        reversedFromId: entryId,
        createdBy,
      })
      .returning();

    // Create reversed lines (swap debit/credit)
    if (originalLines.length > 0) {
      await tx.insert(journalLines).values(
        originalLines.map((line, index) => ({
          journalEntryId: reversalEntry.id,
          accountCode: line.accountCode,
          deptCode: line.deptCode,
          debit: line.credit, // swap
          credit: line.debit, // swap
          description: line.description
            ? `Reversal: ${line.description}`
            : "Reversal",
          sortOrder: index,
        }))
      );
    }

    // Mark original as reversed
    await tx
      .update(journalEntries)
      .set({ status: "reversed", updatedAt: new Date() })
      .where(eq(journalEntries.id, entryId));

    return reversalEntry;
  });
}

export async function getJournalEntryStats(
  db: Db,
  tenantId: string,
  dateFrom: string,
  dateTo: string
) {
  const conditions = [
    eq(journalEntries.tenantId, tenantId),
    gte(journalEntries.date, dateFrom),
    lte(journalEntries.date, dateTo),
  ];

  const whereClause = and(...conditions);

  // Entry counts
  const [totalResult] = await db
    .select({ total: count() })
    .from(journalEntries)
    .where(whereClause);

  const [draftResult] = await db
    .select({ total: count() })
    .from(journalEntries)
    .where(and(...conditions, eq(journalEntries.status, "draft")));

  // Debit/credit totals from lines of matching entries
  const [totals] = await db
    .select({
      totalDebits: sum(journalLines.debit),
      totalCredits: sum(journalLines.credit),
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .where(whereClause);

  return {
    totalEntries: totalResult?.total ?? 0,
    draftCount: draftResult?.total ?? 0,
    totalDebits: Number(totals?.totalDebits ?? 0),
    totalCredits: Number(totals?.totalCredits ?? 0),
  };
}
