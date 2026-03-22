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
  getJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
} from "@/lib/db/queries/journal-entries";

// ── Validation schemas ──────────────────────────────────────────────────────

const JOURNAL_TYPES = ["RV", "SV", "PV", "PurV", "JV", "Manual"] as const;

const journalLineSchema = z.object({
  accountCode: z.string().min(1),
  deptCode: z.string().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  description: z.string(),
});

const updateBodySchema = z.object({
  date: z.string().min(1),
  type: z.enum(JOURNAL_TYPES),
  description: z.string().min(1),
  status: z.enum(["draft", "posted"]).optional(),
  lines: z.array(journalLineSchema).min(1),
});

const patchBodySchema = z.object({
  action: z.enum(["post", "reverse"]),
});

type RouteParams = { params: Promise<{ id: string; entryId: string }> };

// ── GET: single journal entry ───────────────────────────────────────────────

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id: tenantId, entryId } = await params;
    if (!ensureTenantScope(ctx.tenantId, tenantId))
      return forbidden("Cross-tenant access denied");

    const entry = await getJournalEntry(db, tenantId, entryId);

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Journal entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("GET /journal-entries/[entryId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journal entry" },
      { status: 500 }
    );
  }
}

// ── PUT: update journal entry ───────────────────────────────────────────────

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id: tenantId, entryId } = await params;
    if (!ensureTenantScope(ctx.tenantId, tenantId))
      return forbidden("Cross-tenant access denied");

    const body = await request.json();
    const parsed = updateBodySchema.safeParse(body);

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

    const updated = await updateJournalEntry(db, tenantId, entryId, {
      date: data.date,
      type: data.type,
      description: data.description,
      lines: data.lines.map((line) => ({
        accountCode: line.accountCode,
        deptCode: line.deptCode ?? null,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("PUT /journal-entries/[entryId] error:", error);

    if (message.includes("not found")) {
      return NextResponse.json(
        { success: false, error: "Journal entry not found" },
        { status: 404 }
      );
    }
    if (message.includes("reversed")) {
      return NextResponse.json(
        { success: false, error: "Cannot update a reversed journal entry" },
        { status: 400 }
      );
    }
    if (message.includes("locked")) {
      return NextResponse.json(
        { success: false, error: "Period is locked" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update journal entry" },
      { status: 500 }
    );
  }
}

// ── PATCH: change status (post or reverse) ──────────────────────────────────

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id: tenantId, entryId } = await params;
    if (!ensureTenantScope(ctx.tenantId, tenantId))
      return forbidden("Cross-tenant access denied");

    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    if (action === "post") {
      const result = await postJournalEntry(db, tenantId, entryId);
      return NextResponse.json({ success: true, data: result });
    }

    // action === "reverse"
    const result = await reverseJournalEntry(
      db,
      tenantId,
      entryId,
      ctx.userId
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("PATCH /journal-entries/[entryId] error:", error);

    if (message.includes("not found")) {
      return NextResponse.json(
        { success: false, error: "Journal entry not found" },
        { status: 404 }
      );
    }
    if (message.includes("Only draft")) {
      return NextResponse.json(
        { success: false, error: "Only draft entries can be posted" },
        { status: 400 }
      );
    }
    if (message.includes("already reversed")) {
      return NextResponse.json(
        { success: false, error: "Entry is already reversed" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update journal entry status" },
      { status: 500 }
    );
  }
}
