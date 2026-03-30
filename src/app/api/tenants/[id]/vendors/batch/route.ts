import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";

type VendorRow = {
  taxId: string;
  name: string;
  address?: string;
  vendorType?: string;
  branchNumber?: string;
  country?: string;
  isNonResident?: boolean;
  defaultExpenseGl?: string;
  defaultWhtRate?: string;
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
    const rows: VendorRow[] = body?.rows;

    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 5000) {
      return NextResponse.json(
        { success: false, error: "rows must be an array with 1-5000 items" },
        { status: 400 }
      );
    }

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

    const inserted = await db.insert(vendors).values(values).returning();

    return NextResponse.json(
      { success: true, data: { count: inserted.length } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Vendors batch insert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import vendors" },
      { status: 500 }
    );
  }
}
