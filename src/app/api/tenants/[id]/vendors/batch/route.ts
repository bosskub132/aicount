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
import { vendors } from "@/lib/db/schema";
import { mapPgError } from "@/lib/api/errors";

const VendorRowSchema = z.object({
  taxId: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  address: z.string().optional(),
  vendorType: z.enum(["company", "individual"]).optional(),
  branchNumber: z.string().optional(),
  country: z.string().optional(),
  isNonResident: z.boolean().optional(),
  defaultExpenseGl: z.string().optional(),
  defaultWhtRate: z.string().optional(),
});

const VendorBatchSchema = z.object({
  rows: z.array(VendorRowSchema).min(1).max(5000),
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
    const parsed = VendorBatchSchema.safeParse(await request.json());
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
      address: row.address || undefined,
      vendorType: row.vendorType || "company",
      branchNumber: row.branchNumber || undefined,
      country: row.country || undefined,
      isNonResident: row.isNonResident ?? false,
      defaultExpenseGl: row.defaultExpenseGl || undefined,
      defaultWhtRate: row.defaultWhtRate || undefined,
    }));

    const inserted = await db
      .insert(vendors)
      .values(values)
      .onConflictDoUpdate({
        target: [vendors.tenantId, vendors.taxId],
        set: {
          name: sql`excluded.name`,
          address: sql`excluded.address`,
          vendorType: sql`excluded.vendor_type`,
          branchNumber: sql`excluded.branch_number`,
          country: sql`excluded.country`,
          isNonResident: sql`excluded.is_non_resident`,
          defaultExpenseGl: sql`excluded.default_expense_gl`,
          defaultWhtRate: sql`excluded.default_wht_rate`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(
      { success: true, data: { count: inserted.length } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Vendors batch insert error:", error);
    return mapPgError(error, "Failed to import vendors");
  }
}
