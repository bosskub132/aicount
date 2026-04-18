import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartOfAccounts } from "@/lib/db/schema";
import { ACCOUNT_CATEGORIES } from "@/lib/utils/constants";
import { mapPgError } from "@/lib/api/errors";

const CoaRowSchema = z.object({
  accountCode: z.string().min(1).max(20),
  accountName: z.string().min(1).max(200),
  category: z.enum(ACCOUNT_CATEGORIES),
  isSuspense: z.boolean().optional(),
  parentCode: z.string().optional(),
});

const CoaBatchSchema = z.object({
  rows: z.array(CoaRowSchema).min(1).max(5000),
});

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
    const parsed = CoaBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { rows } = parsed.data;

    const values = rows.map((row) => ({
      tenantId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      category: row.category,
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
    return mapPgError(error, "Failed to import chart of accounts");
  }
}
