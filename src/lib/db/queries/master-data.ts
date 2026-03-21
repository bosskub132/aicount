import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartOfAccounts, customers, departments, products, vendors } from "@/lib/db/schema";

export async function getMasterDataSnapshot(tenantId: string) {
  const [coa, vendorRows, customerRows, productRows, departmentRows] = await Promise.all([
    db.select().from(chartOfAccounts).where(and(eq(chartOfAccounts.tenantId, tenantId), eq(chartOfAccounts.isActive, true))),
    db.select().from(vendors).where(and(eq(vendors.tenantId, tenantId), eq(vendors.isActive, true))),
    db.select().from(customers).where(and(eq(customers.tenantId, tenantId), eq(customers.isActive, true))),
    db.select().from(products).where(and(eq(products.tenantId, tenantId), eq(products.isActive, true))),
    db.select().from(departments).where(and(eq(departments.tenantId, tenantId), eq(departments.isActive, true))),
  ]);

  return {
    chartOfAccounts: coa,
    vendors: vendorRows,
    customers: customerRows,
    products: productRows,
    departments: departmentRows,
  };
}

