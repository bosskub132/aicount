import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const rows = await db.select().from(vendors).where(and(eq(vendors.tenantId, tenantId), eq(vendors.isActive, true)));
  return NextResponse.json({ success: true, data: rows });
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
      address?: string;
      defaultExpenseGl?: string;
      defaultWhtRate?: number;
    };
    const [created] = await db
      .insert(vendors)
      .values({
        tenantId,
        taxId: body.taxId,
        name: body.name,
        address: body.address,
        defaultExpenseGl: body.defaultExpenseGl,
        defaultWhtRate: body.defaultWhtRate != null ? String(body.defaultWhtRate) : "3.00",
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
    taxId?: string;
    name?: string;
    address?: string;
    defaultExpenseGl?: string;
    defaultWhtRate?: number;
    isActive?: boolean;
  };
  const [updated] = await db
    .update(vendors)
    .set({
      taxId: body.taxId,
      name: body.name,
      address: body.address,
      defaultExpenseGl: body.defaultExpenseGl,
      defaultWhtRate: body.defaultWhtRate != null ? String(body.defaultWhtRate) : undefined,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(vendors.id, body.id), eq(vendors.tenantId, tenantId)))
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
    .update(vendors)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(vendors.id, body.id), eq(vendors.tenantId, tenantId)))
    .returning();
  return NextResponse.json({ success: true, data: deleted });
}


