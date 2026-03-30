import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";

type CustomerRow = {
  taxId: string;
  name: string;
  address?: string;
  creditTermDays?: string;
  branchNumber?: string;
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
    const rows: CustomerRow[] = body?.rows;

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
      branchNumber: row.branchNumber || undefined,
      creditTermDays: row.creditTermDays
        ? parseInt(row.creditTermDays, 10)
        : undefined,
    }));

    const inserted = await db.insert(customers).values(values).returning();

    return NextResponse.json(
      { success: true, data: { count: inserted.length } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Customers batch insert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import customers" },
      { status: 500 }
    );
  }
}
