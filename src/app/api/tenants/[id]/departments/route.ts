import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { departments } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const rows = await db
    .select()
    .from(departments)
    .where(and(eq(departments.tenantId, tenantId), eq(departments.isActive, true)));
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await context.params;
    const body = (await request.json()) as {
      deptCode: string;
      deptName: string;
    };
    const [created] = await db
      .insert(departments)
      .values({
        tenantId,
        deptCode: body.deptCode,
        deptName: body.deptName,
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
    deptCode?: string;
    deptName?: string;
    isActive?: boolean;
  };
  const [updated] = await db
    .update(departments)
    .set({
      deptCode: body.deptCode,
      deptName: body.deptName,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(departments.id, body.id), eq(departments.tenantId, tenantId)))
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
    .update(departments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(departments.id, body.id), eq(departments.tenantId, tenantId)))
    .returning();
  return NextResponse.json({ success: true, data: deleted });
}


