import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chartOfAccounts } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  const rows = await db
    .select()
    .from(chartOfAccounts)
    .where(and(eq(chartOfAccounts.tenantId, tenantId), eq(chartOfAccounts.isActive, true)));
  return NextResponse.json({ success: true, data: rows });
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
    const err = error as Record<string, unknown>;
    const code = String(err.code ?? "");
    const msg = String(err.message ?? "");
    console.error("COA create error:", { code, msg, detail: err.detail });
    if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
      return NextResponse.json({ success: false, error: "An account with this code already exists." }, { status: 409 });
    }
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


