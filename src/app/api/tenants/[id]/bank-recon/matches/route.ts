import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { createMatch, deleteMatch } from "@/lib/db/queries/bank-recon";

/**
 * POST /api/tenants/[id]/bank-recon/matches
 * Confirm a match between a bank transaction and a journal entry.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  try {
    const body = await request.json();
    const { bankTransactionId, journalEntryId, matchType } = body;

    if (!bankTransactionId || !journalEntryId) {
      return NextResponse.json(
        { success: false, error: "bankTransactionId and journalEntryId are required" },
        { status: 400 },
      );
    }

    const validMatchTypes = ["auto", "manual"];
    const resolvedMatchType = validMatchTypes.includes(matchType) ? matchType : "manual";

    const match = await createMatch(
      db,
      id,
      bankTransactionId,
      journalEntryId,
      resolvedMatchType,
    );

    return NextResponse.json({ success: true, data: match });
  } catch (error) {
    console.error("Failed to create bank recon match:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create match" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/tenants/[id]/bank-recon/matches
 * Remove (unmatch) a reconciliation match.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  try {
    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { success: false, error: "matchId is required" },
        { status: 400 },
      );
    }

    const deleted = await deleteMatch(db, id, matchId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Match not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("Failed to delete bank recon match:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete match" },
      { status: 500 },
    );
  }
}
