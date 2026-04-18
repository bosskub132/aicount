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
import { customers } from "@/lib/db/schema";
import { mapPgError } from "@/lib/api/errors";

const CustomerRowSchema = z.object({
  taxId: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  address: z.string().optional(),
  creditTermDays: z.string().optional(),
  branchNumber: z.string().optional(),
});

const CustomerBatchSchema = z.object({
  rows: z.array(CustomerRowSchema).min(1).max(5000),
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
    const parsed = CustomerBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { rows } = parsed.data;

    const values = rows.map((row) => ({
      tenantId,
      taxId: row.taxId,
      name: row.name,
      branchNumber: row.branchNumber || undefined,
      creditTermDays: row.creditTermDays
        ? parseInt(row.creditTermDays, 10)
        : undefined,
    }));

    const inserted = await db
      .insert(customers)
      .values(values)
      .onConflictDoUpdate({
        target: [customers.tenantId, customers.taxId],
        set: {
          name: sql`excluded.name`,
          branchNumber: sql`excluded.branch_number`,
          creditTermDays: sql`excluded.credit_term_days`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(
      { success: true, data: { count: inserted.length } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Customers batch insert error:", error);
    return mapPgError(error, "Failed to import customers");
  }
}
