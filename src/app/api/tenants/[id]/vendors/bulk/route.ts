import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { id: tenantId } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");
    const body = (await request.json()) as {
      upserts?: Array<{
        id?: string;
        taxId: string;
        name: string;
        address?: string;
        defaultExpenseGl?: string;
        defaultWhtRate?: number;
        vendorType?: string;
        isNonResident?: boolean;
        branchNumber?: string;
        country?: string;
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
            vendorType: row.vendorType,
            isNonResident: row.isNonResident,
            branchNumber: row.branchNumber,
            country: row.country,
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
          vendorType: row.vendorType ?? "company",
          isNonResident: row.isNonResident ?? false,
          branchNumber: row.branchNumber,
          country: row.country,
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
    console.error("[tenants/vendors/bulk POST]", error);
    return NextResponse.json(
      { success: false, error: "Bulk vendors operation failed" },
      { status: 500 }
    );
  }
}


