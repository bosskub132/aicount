import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const rows = await db.select().from(products).where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)));
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await context.params;
    const body = (await request.json()) as {
      itemCode: string;
      itemName: string;
      keywords?: string[];
      incomeGl?: string;
      expenseGl?: string;
    };
    const [created] = await db
      .insert(products)
      .values({
        tenantId,
        itemCode: body.itemCode,
        itemName: body.itemName,
        keywords: body.keywords || [],
        incomeGl: body.incomeGl,
        expenseGl: body.expenseGl,
      })
      .returning();
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const body = (await request.json()) as {
    id: string;
    itemCode?: string;
    itemName?: string;
    keywords?: string[];
    incomeGl?: string;
    expenseGl?: string;
    isActive?: boolean;
  };
  const [updated] = await db
    .update(products)
    .set({
      itemCode: body.itemCode,
      itemName: body.itemName,
      keywords: body.keywords,
      incomeGl: body.incomeGl,
      expenseGl: body.expenseGl,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, body.id), eq(products.tenantId, tenantId)))
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
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(products.id, body.id), eq(products.tenantId, tenantId)))
    .returning();
  return NextResponse.json({ success: true, data: deleted });
}


