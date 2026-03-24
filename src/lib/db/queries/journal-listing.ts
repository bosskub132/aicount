import { and, between, count, eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  chartOfAccounts,
  journalEntries,
  journalLines,
} from "@/lib/db/schema";
import { resolvePeriodDates } from "./period-utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface JournalListingLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface JournalListingEntry {
  id: string;
  jvNo: string;
  date: string;
  description: string;
  type: string;
  lines: JournalListingLine[];
  totalDebit: number;
  totalCredit: number;
}

export interface JournalListingResult {
  period: { start: string; end: string };
  entries: JournalListingEntry[];
  summary: {
    totalEntries: number;
    totalDebit: number;
    totalCredit: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ── Main Query ───────────────────────────────────────────────────────────────

export async function getJournalListing(
  tenantId: string,
  params: {
    period: string;
    scope: string;
    type?: string;
    page?: number;
    limit?: number;
  }
): Promise<JournalListingResult> {
  const dates = resolvePeriodDates(params.period, params.scope);
  const page = Math.max(params.page ?? DEFAULT_PAGE, 1);
  const limit = Math.min(
    Math.max(params.limit ?? DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const offset = (page - 1) * limit;

  // Build filter conditions
  const conditions = [
    eq(journalEntries.tenantId, tenantId),
    between(journalEntries.date, dates.start, dates.end),
    eq(journalEntries.status, "posted"),
  ];

  if (params.type) {
    conditions.push(eq(journalEntries.type, params.type as typeof journalEntries.type.enumValues[number]));
  }

  // Count total matching entries
  const [countRow] = await db
    .select({ total: count() })
    .from(journalEntries)
    .where(and(...conditions));

  const total = countRow?.total ?? 0;

  // Fetch paginated entry headers
  const headers = await db
    .select({
      id: journalEntries.id,
      jvNumber: journalEntries.jvNumber,
      date: journalEntries.date,
      description: journalEntries.description,
      type: journalEntries.type,
    })
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.date), journalEntries.jvNumber)
    .limit(limit)
    .offset(offset);

  // Fetch period-wide totals (not page-scoped) for the summary
  const [periodTotals] = await db
    .select({
      totalDebit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .where(and(...conditions));

  const periodDebit = Number(periodTotals?.totalDebit ?? 0);
  const periodCredit = Number(periodTotals?.totalCredit ?? 0);

  if (headers.length === 0) {
    return {
      period: dates,
      entries: [],
      summary: { totalEntries: total, totalDebit: periodDebit, totalCredit: periodCredit },
      pagination: { page, limit, total },
    };
  }

  // Fetch all lines for these entries in one query
  const entryIds = headers.map((h) => h.id);
  const lines = await db
    .select({
      journalEntryId: journalLines.journalEntryId,
      accountCode: journalLines.accountCode,
      accountName: chartOfAccounts.accountName,
      debit: journalLines.debit,
      credit: journalLines.credit,
      sortOrder: journalLines.sortOrder,
    })
    .from(journalLines)
    .leftJoin(
      chartOfAccounts,
      and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.accountCode, journalLines.accountCode)
      )
    )
    .where(
      sql`${journalLines.journalEntryId} = ANY(${entryIds})`
    )
    .orderBy(journalLines.sortOrder);

  // Group lines by entry
  const linesByEntry = new Map<string, JournalListingLine[]>();
  for (const line of lines) {
    const entryId = line.journalEntryId;
    if (!entryId) continue;
    const existing = linesByEntry.get(entryId) ?? [];
    existing.push({
      accountCode: line.accountCode,
      accountName: line.accountName ?? line.accountCode,
      debit: Number(line.debit),
      credit: Number(line.credit),
    });
    linesByEntry.set(entryId, existing);
  }

  // Assemble entries
  const entries: JournalListingEntry[] = headers.map((header) => {
    const entryLines = linesByEntry.get(header.id) ?? [];
    const totalDebit = entryLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = entryLines.reduce((s, l) => s + l.credit, 0);

    return {
      id: header.id,
      jvNo: header.jvNumber,
      date: header.date,
      description: header.description,
      type: header.type,
      lines: entryLines,
      totalDebit,
      totalCredit,
    };
  });

  return {
    period: dates,
    entries,
    summary: {
      totalEntries: total,
      totalDebit: periodDebit,
      totalCredit: periodCredit,
    },
    pagination: { page, limit, total },
  };
}
