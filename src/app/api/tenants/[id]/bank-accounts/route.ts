import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankAccounts } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const rows = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.tenantId, id), eq(bankAccounts.isActive, true)));

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const body = (await request.json()) as {
      bankName: string;
      accountNumber: string;
      glAccountCode?: string;
    };

    if (!body.bankName || !body.accountNumber) {
      return NextResponse.json(
        { success: false, error: "Bank name and account number are required." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(bankAccounts)
      .values({
        tenantId: id,
        bankName: body.bankName,
        accountNumber: body.accountNumber,
        glAccountCode: body.glAccountCode || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Bank account create error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create bank account." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const body = (await request.json()) as {
      id: string;
      bankName?: string;
      accountNumber?: string;
      glAccountCode?: string;
    };

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Account id is required." },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(bankAccounts)
      .set({
        ...(body.bankName !== undefined && { bankName: body.bankName }),
        ...(body.accountNumber !== undefined && { accountNumber: body.accountNumber }),
        ...(body.glAccountCode !== undefined && { glAccountCode: body.glAccountCode }),
      })
      .where(and(eq(bankAccounts.id, body.id), eq(bankAccounts.tenantId, id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Bank account not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Bank account update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update bank account." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const body = (await request.json()) as { id: string };

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Account id is required." },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .update(bankAccounts)
      .set({ isActive: false })
      .where(and(eq(bankAccounts.id, body.id), eq(bankAccounts.tenantId, id)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Bank account not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("Bank account delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete bank account." },
      { status: 500 }
    );
  }
}
