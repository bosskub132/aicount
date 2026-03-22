import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { getAccountLedger } from "@/lib/db/queries/account-ledger";

// ── Validation schema ───────────────────────────────────────────────────────

const ledgerQuerySchema = z.object({
  accountCode: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
});

// ── GET: account ledger with running balance ────────────────────────────────

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
    const parsed = ledgerQuerySchema.safeParse({
      accountCode: searchParams.get("accountCode") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required parameters: accountCode, dateFrom, dateTo",
        },
        { status: 400 }
      );
    }

    const { accountCode, dateFrom, dateTo } = parsed.data;
    const result = await getAccountLedger(
      db,
      tenantId,
      accountCode,
      dateFrom,
      dateTo
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /account-ledger error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch account ledger" },
      { status: 500 }
    );
  }
}
