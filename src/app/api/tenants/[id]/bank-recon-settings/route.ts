import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankReconSettings } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

const DEFAULTS = {
  amountTolerance: "0.50",
  dateRangeDays: 3,
  autoMatch: true,
  matchByReference: true,
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const [row] = await db
    .select()
    .from(bankReconSettings)
    .where(eq(bankReconSettings.tenantId, id));

  return NextResponse.json({
    success: true,
    data: row ?? { ...DEFAULTS, tenantId: id },
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const body = (await request.json()) as {
      amountTolerance?: string;
      dateRangeDays?: number;
      autoMatch?: boolean;
      matchByReference?: boolean;
    };

    const [upserted] = await db
      .insert(bankReconSettings)
      .values({
        tenantId: id,
        amountTolerance: body.amountTolerance ?? DEFAULTS.amountTolerance,
        dateRangeDays: body.dateRangeDays ?? DEFAULTS.dateRangeDays,
        autoMatch: body.autoMatch ?? DEFAULTS.autoMatch,
        matchByReference: body.matchByReference ?? DEFAULTS.matchByReference,
      })
      .onConflictDoUpdate({
        target: bankReconSettings.tenantId,
        set: {
          amountTolerance: body.amountTolerance ?? DEFAULTS.amountTolerance,
          dateRangeDays: body.dateRangeDays ?? DEFAULTS.dateRangeDays,
          autoMatch: body.autoMatch ?? DEFAULTS.autoMatch,
          matchByReference: body.matchByReference ?? DEFAULTS.matchByReference,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ success: true, data: upserted });
  } catch (error) {
    console.error("Bank recon settings upsert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save settings." },
      { status: 500 }
    );
  }
}
