import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chartOfAccounts } from "@/lib/db/schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await context.params;
    const body = (await request.json()) as {
      upserts?: Array<{
        id?: string;
        accountCode: string;
        accountName: string;
        category: "asset" | "liability" | "equity" | "revenue" | "expense";
        isSuspense?: boolean;
      }>;
      deactivateIds?: string[];
    };

    const upserts = Array.isArray(body.upserts) ? body.upserts : [];
    const deactivateIds = Array.isArray(body.deactivateIds) ? body.deactivateIds : [];
    const results = { created: 0, updated: 0, deactivated: 0 };

    for (const row of upserts) {
      if (row.id) {
        const [updated] = await db
          .update(chartOfAccounts)
          .set({
            accountCode: row.accountCode,
            accountName: row.accountName,
            category: row.category,
            isSuspense: Boolean(row.isSuspense),
            updatedAt: new Date(),
          })
          .where(and(eq(chartOfAccounts.id, row.id), eq(chartOfAccounts.tenantId, tenantId)))
          .returning({ id: chartOfAccounts.id });
        if (updated) results.updated += 1;
      } else {
        await db.insert(chartOfAccounts).values({
          tenantId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          category: row.category,
          isSuspense: Boolean(row.isSuspense),
        });
        results.created += 1;
      }
    }

    if (deactivateIds.length) {
      const rows = await db
        .update(chartOfAccounts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(chartOfAccounts.tenantId, tenantId), inArray(chartOfAccounts.id, deactivateIds)))
        .returning({ id: chartOfAccounts.id });
      results.deactivated = rows.length;
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Bulk COA failed" },
      { status: 500 }
    );
  }
}


