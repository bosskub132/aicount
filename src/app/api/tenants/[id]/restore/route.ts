import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  chartOfAccounts,
  customers,
  departments,
  products,
  vendors,
} from "@/lib/db/schema";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id) && !ensureRole(ctx.role, ["admin"])) {
      return forbidden("Cross-tenant access denied");
    }
    if (!ensureRole(ctx.role, ["admin"])) return forbidden("Only admin can run restore");

    const body = (await request.json()) as {
      chartOfAccounts?: Array<{ accountCode: string; accountName: string; category: "asset" | "liability" | "equity" | "revenue" | "expense" }>;
      vendors?: Array<{ taxId: string; name: string; vendorType?: string; isNonResident?: boolean; branchNumber?: string; country?: string }>;
      customers?: Array<{ taxId: string; name: string; branchNumber?: string }>;
      products?: Array<{ itemCode: string; itemName: string }>;
      departments?: Array<{ deptCode: string; deptName: string }>;
      purgeExisting?: boolean;
    };

    if (body.purgeExisting) {
      await db.delete(chartOfAccounts).where(eq(chartOfAccounts.tenantId, id));
      await db.delete(vendors).where(eq(vendors.tenantId, id));
      await db.delete(customers).where(eq(customers.tenantId, id));
      await db.delete(products).where(eq(products.tenantId, id));
      await db.delete(departments).where(eq(departments.tenantId, id));
    }

    if (Array.isArray(body.chartOfAccounts) && body.chartOfAccounts.length) {
      await db.insert(chartOfAccounts).values(
        body.chartOfAccounts.map((row) => ({
          tenantId: id,
          accountCode: row.accountCode,
          accountName: row.accountName,
          category: row.category,
        }))
      );
    }
    if (Array.isArray(body.vendors) && body.vendors.length) {
      await db.insert(vendors).values(body.vendors.map((row) => ({
        tenantId: id,
        taxId: row.taxId,
        name: row.name,
        vendorType: row.vendorType ?? "company",
        isNonResident: row.isNonResident ?? false,
        branchNumber: row.branchNumber,
        country: row.country,
      })));
    }
    if (Array.isArray(body.customers) && body.customers.length) {
      await db.insert(customers).values(
        body.customers.map((row) => ({
          tenantId: id,
          taxId: row.taxId,
          name: row.name,
          branchNumber: row.branchNumber,
        }))
      );
    }
    if (Array.isArray(body.products) && body.products.length) {
      await db.insert(products).values(
        body.products.map((row) => ({ tenantId: id, itemCode: row.itemCode, itemName: row.itemName }))
      );
    }
    if (Array.isArray(body.departments) && body.departments.length) {
      await db.insert(departments).values(
        body.departments.map((row) => ({ tenantId: id, deptCode: row.deptCode, deptName: row.deptName }))
      );
    }

    return NextResponse.json({ success: true, data: { tenantId: id, restored: true } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Restore failed" },
      { status: 500 }
    );
  }
}

