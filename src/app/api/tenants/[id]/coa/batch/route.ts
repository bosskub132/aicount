import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartOfAccounts } from "@/lib/db/schema";

type CoaRow = {
  accountCode: string;
  accountName: string;
  category: string;
  isSuspense?: boolean;
  parentCode?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId))
    return forbidden("Cross-tenant access denied");

  try {
    const body = await request.json();
    const rows: CoaRow[] = body?.rows;

    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 5000) {
      return NextResponse.json(
        { success: false, error: "rows must be an array with 1-5000 items" },
        { status: 400 }
      );
    }

    const values = rows.map((row) => ({
      tenantId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      category: row.category as
        | "asset"
        | "liability"
        | "equity"
        | "revenue"
        | "expense",
      isSuspense: row.isSuspense ?? false,
    }));

    const inserted = await db
      .insert(chartOfAccounts)
      .values(values)
      .onConflictDoUpdate({
        target: [chartOfAccounts.tenantId, chartOfAccounts.accountCode],
        set: {
          accountName: sql`excluded.account_name`,
          category: sql`excluded.category`,
          isSuspense: sql`excluded.is_suspense`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(
      { success: true, data: { count: inserted.length } },
      { status: 201 }
    );
  } catch (error) {
    console.error("COA batch insert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import chart of accounts" },
      { status: 500 }
    );
  }
}
