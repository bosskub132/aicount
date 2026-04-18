import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartOfAccounts, customers, departments, products, vendors } from "@/lib/db/schema";

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

function normalizeListParams(params: ListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const search = (params.search ?? "").slice(0, 200).trim();
  return { page, limit, search, offset: (page - 1) * limit };
}

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

export async function listCoa(tenantId: string, params: ListParams = {}) {
  const { page, limit, search, offset } = normalizeListParams(params);
  let where = and(eq(chartOfAccounts.tenantId, tenantId), eq(chartOfAccounts.isActive, true));
  if (search) {
    where = and(
      where,
      or(
        ilike(chartOfAccounts.accountCode, `%${search}%`),
        ilike(chartOfAccounts.accountName, `%${search}%`)
      )
    );
  }
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chartOfAccounts)
    .where(where);
  const total = Number(countResult?.count ?? 0);
  const rows = await db
    .select()
    .from(chartOfAccounts)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(asc(chartOfAccounts.accountCode));
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listVendors(tenantId: string, params: ListParams = {}) {
  const { page, limit, search, offset } = normalizeListParams(params);
  let where = and(eq(vendors.tenantId, tenantId), eq(vendors.isActive, true));
  if (search) {
    where = and(
      where,
      or(ilike(vendors.name, `%${search}%`), ilike(vendors.taxId, `%${search}%`))
    );
  }
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendors)
    .where(where);
  const total = Number(countResult?.count ?? 0);
  const rows = await db
    .select()
    .from(vendors)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(asc(vendors.name));
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listCustomers(tenantId: string, params: ListParams = {}) {
  const { page, limit, search, offset } = normalizeListParams(params);
  let where = and(eq(customers.tenantId, tenantId), eq(customers.isActive, true));
  if (search) {
    where = and(
      where,
      or(ilike(customers.name, `%${search}%`), ilike(customers.taxId, `%${search}%`))
    );
  }
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(where);
  const total = Number(countResult?.count ?? 0);
  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(asc(customers.name));
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listDepartments(tenantId: string, params: ListParams = {}) {
  const { page, limit, search, offset } = normalizeListParams(params);
  let where = and(eq(departments.tenantId, tenantId), eq(departments.isActive, true));
  if (search) {
    where = and(
      where,
      or(
        ilike(departments.deptCode, `%${search}%`),
        ilike(departments.deptName, `%${search}%`)
      )
    );
  }
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(departments)
    .where(where);
  const total = Number(countResult?.count ?? 0);
  const rows = await db
    .select()
    .from(departments)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(asc(departments.deptCode));
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listProducts(tenantId: string, params: ListParams = {}) {
  const { page, limit, search, offset } = normalizeListParams(params);
  let where = and(eq(products.tenantId, tenantId), eq(products.isActive, true));
  if (search) {
    where = and(
      where,
      or(
        ilike(products.itemCode, `%${search}%`),
        ilike(products.itemName, `%${search}%`)
      )
    );
  }
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);
  const total = Number(countResult?.count ?? 0);
  const rows = await db
    .select()
    .from(products)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(asc(products.itemCode));
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
