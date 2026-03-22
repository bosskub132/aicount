import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import {
  listJournalEntries,
  createJournalEntry,
  getJournalEntryStats,
} from "@/lib/db/queries/journal-entries";

// ── Validation schemas ──────────────────────────────────────────────────────

const JOURNAL_TYPES = ["RV", "SV", "PV", "PurV", "JV", "Manual"] as const;
const JOURNAL_STATUSES = ["draft", "posted", "reversed"] as const;

const listQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  type: z.enum(JOURNAL_TYPES).optional(),
  status: z.enum(JOURNAL_STATUSES).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const journalLineSchema = z.object({
  accountCode: z.string().min(1),
  deptCode: z.string().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  description: z.string(),
});

const createBodySchema = z.object({
  date: z.string().min(1),
  type: z.enum(JOURNAL_TYPES),
  description: z.string().min(1),
  status: z.enum(["draft", "posted"]).optional(),
  lines: z.array(journalLineSchema).min(1),
});

// ── GET: list journal entries ───────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id: tenantId } = await params;
    if (!ensureTenantScope(ctx.tenantId, tenantId))
      return forbidden("Cross-tenant access denied");

    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    const filters = parsed.data;
    const result = await listJournalEntries(db, tenantId, filters);

    // Fetch stats for the current date range (or reasonable defaults)
    const now = new Date();
    const statsFrom = filters.dateFrom ?? `${now.getFullYear()}-01-01`;
    const statsTo = filters.dateTo ?? now.toISOString().slice(0, 10);
    const stats = await getJournalEntryStats(db, tenantId, statsFrom, statsTo);

    return NextResponse.json({
      success: true,
      data: {
        entries: result.entries,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        stats,
      },
    });
  } catch (error) {
    console.error("GET /journal-entries error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list journal entries" },
      { status: 500 }
    );
  }
}

// ── POST: create journal entry ──────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id: tenantId } = await params;
    if (!ensureTenantScope(ctx.tenantId, tenantId))
      return forbidden("Cross-tenant access denied");

    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate: sum of debits must equal sum of credits
    const totalDebits = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = data.lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.005) {
      return NextResponse.json(
        {
          success: false,
          error: "Sum of debits must equal sum of credits",
        },
        { status: 400 }
      );
    }

    const entry = await createJournalEntry(db, tenantId, {
      date: data.date,
      type: data.type,
      description: data.description,
      createdBy: ctx.userId,
      lines: data.lines.map((line) => ({
        accountCode: line.accountCode,
        deptCode: line.deptCode ?? null,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("POST /journal-entries error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create journal entry" },
      { status: 500 }
    );
  }
}
