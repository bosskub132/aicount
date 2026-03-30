import { sql, and, eq, or, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const search = (searchParams.get("search") || "").slice(0, 200);
  const offset = (page - 1) * limit;

  let where = and(eq(customers.tenantId, tenantId), eq(customers.isActive, true));
  if (search) {
    where = and(where, or(ilike(customers.name, `%${search}%`), ilike(customers.taxId, `%${search}%`)));
  }

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(customers).where(where);
  const total = Number(countResult.count);
  const rows = await db.select().from(customers).where(where).limit(limit).offset(offset).orderBy(customers.name);

  return NextResponse.json({
    success: true,
    data: rows,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await context.params;
    const body = (await request.json()) as {
      taxId: string;
      name: string;
      creditTermDays?: number;
      branchNumber?: string;
    };
    const [created] = await db
      .insert(customers)
      .values({
        tenantId,
        taxId: body.taxId,
        name: body.name,
        creditTermDays: body.creditTermDays ?? 30,
        branchNumber: body.branchNumber,
      })
      .returning();
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause;
    if (cause?.code === "23505") {
      return NextResponse.json({ success: false, error: "A customer with this tax ID already exists." }, { status: 409 });
    }
    console.error("Customer create error:", error);
    return NextResponse.json({ success: false, error: "Failed to create customer." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const body = (await request.json()) as {
    id: string;
    taxId?: string;
    name?: string;
    creditTermDays?: number;
    branchNumber?: string;
    isActive?: boolean;
  };
  const [updated] = await db
    .update(customers)
    .set({
      taxId: body.taxId,
      name: body.name,
      creditTermDays: body.creditTermDays,
      branchNumber: body.branchNumber,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(customers.id, body.id), eq(customers.tenantId, tenantId)))
    .returning();
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const body = (await request.json()) as { id: string };
  const [deleted] = await db
    .update(customers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(customers.id, body.id), eq(customers.tenantId, tenantId)))
    .returning();
  return NextResponse.json({ success: true, data: deleted });
}


