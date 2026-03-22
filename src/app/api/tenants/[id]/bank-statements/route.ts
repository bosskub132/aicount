import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankStatements } from "@/lib/db/schema";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const rows = await db
    .select()
    .from(bankStatements)
    .where(eq(bankStatements.tenantId, id))
    .orderBy(desc(bankStatements.statementDate));
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
    if (!ensureRole(ctx.role, ["admin", "maker", "checker"])) {
      return forbidden("Role not allowed");
    }

    const body = (await request.json()) as {
      statementDate: string;
      balance?: number;
      lineItems?: Array<Record<string, unknown>>;
    };

    const [created] = await db
      .insert(bankStatements)
      .values({
        tenantId: id,
        statementDate: body.statementDate,
        balance: body.balance != null ? String(body.balance) : null,
        lineItems: body.lineItems || [],
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tenants/[id]/bank-statements failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload bank statement" },
      { status: 500 }
    );
  }
}

