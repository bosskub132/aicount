import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await context.params;
    const body = (await request.json()) as {
      upserts?: Array<{
        id?: string;
        taxId: string;
        name: string;
        address?: string;
        defaultExpenseGl?: string;
        defaultWhtRate?: number;
      }>;
      deactivateIds?: string[];
    };

    const upserts = Array.isArray(body.upserts) ? body.upserts : [];
    const deactivateIds = Array.isArray(body.deactivateIds) ? body.deactivateIds : [];

    const results: { created: number; updated: number; deactivated: number } = {
      created: 0,
      updated: 0,
      deactivated: 0,
    };

    for (const row of upserts) {
      if (row.id) {
        const [updated] = await db
          .update(vendors)
          .set({
            taxId: row.taxId,
            name: row.name,
            address: row.address,
            defaultExpenseGl: row.defaultExpenseGl,
            defaultWhtRate: row.defaultWhtRate != null ? String(row.defaultWhtRate) : undefined,
            updatedAt: new Date(),
          })
          .where(and(eq(vendors.id, row.id), eq(vendors.tenantId, tenantId)))
          .returning({ id: vendors.id });
        if (updated) results.updated += 1;
      } else {
        await db.insert(vendors).values({
          tenantId,
          taxId: row.taxId,
          name: row.name,
          address: row.address,
          defaultExpenseGl: row.defaultExpenseGl,
          defaultWhtRate: row.defaultWhtRate != null ? String(row.defaultWhtRate) : "3.00",
        });
        results.created += 1;
      }
    }

    if (deactivateIds.length) {
      const rows = await db
        .update(vendors)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(vendors.tenantId, tenantId), inArray(vendors.id, deactivateIds)))
        .returning({ id: vendors.id });
      results.deactivated = rows.length;
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Bulk vendors failed" },
      { status: 500 }
    );
  }
}


