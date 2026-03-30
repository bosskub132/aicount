import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const rows = await db.select().from(customers).where(and(eq(customers.tenantId, tenantId), eq(customers.isActive, true)));
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


