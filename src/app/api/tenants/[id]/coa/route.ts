import { sql, and, eq, or, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chartOfAccounts } from "@/lib/db/schema";
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

  let where = and(eq(chartOfAccounts.tenantId, tenantId), eq(chartOfAccounts.isActive, true));
  if (search) {
    where = and(where, or(ilike(chartOfAccounts.accountCode, `%${search}%`), ilike(chartOfAccounts.accountName, `%${search}%`)));
  }

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(chartOfAccounts).where(where);
  const total = Number(countResult.count);
  const rows = await db.select().from(chartOfAccounts).where(where).limit(limit).offset(offset).orderBy(chartOfAccounts.accountCode);

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
      accountCode: string;
      accountName: string;
      category: "asset" | "liability" | "equity" | "revenue" | "expense";
      isSuspense?: boolean;
    };
    const [created] = await db
      .insert(chartOfAccounts)
      .values({
        tenantId,
        accountCode: body.accountCode,
        accountName: body.accountName,
        category: body.category,
        isSuspense: Boolean(body.isSuspense),
      })
      .returning();
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause;
    const pgCode = cause?.code ?? "";
    if (pgCode === "23505") {
      return NextResponse.json({ success: false, error: "An account with this code already exists." }, { status: 409 });
    }
    console.error("COA create error:", error);
    return NextResponse.json({ success: false, error: "Failed to create account." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const body = (await request.json()) as {
    id: string;
    accountName?: string;
    category?: "asset" | "liability" | "equity" | "revenue" | "expense";
    isSuspense?: boolean;
    isActive?: boolean;
  };
  const [updated] = await db
    .update(chartOfAccounts)
    .set({
      accountName: body.accountName,
      category: body.category,
      isSuspense: body.isSuspense,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(chartOfAccounts.id, body.id), eq(chartOfAccounts.tenantId, tenantId)))
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
    .update(chartOfAccounts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(chartOfAccounts.id, body.id), eq(chartOfAccounts.tenantId, tenantId)))
    .returning();
  return NextResponse.json({ success: true, data: deleted });
}


