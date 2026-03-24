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
      vendorType?: string;
      isNonResident?: boolean;
      branchNumber?: string;
      country?: string;
    };

    const validVendorTypes = ["individual", "company"] as const;
    const vendorType = body.vendorType ?? "company";
    if (!validVendorTypes.includes(vendorType as typeof validVendorTypes[number])) {
      return NextResponse.json(
        { success: false, error: "vendorType must be 'individual' or 'company'" },
        { status: 400 }
      );
    }

    const isNonResident = body.isNonResident ?? false;
    if (isNonResident && !body.country) {
      return NextResponse.json(
        { success: false, error: "country is required when isNonResident is true" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(vendors)
      .values({
        tenantId,
        taxId: body.taxId,
        name: body.name,
        address: body.address,
        defaultExpenseGl: body.defaultExpenseGl,
        defaultWhtRate: body.defaultWhtRate != null ? String(body.defaultWhtRate) : "3.00",
        vendorType,
        isNonResident,
        branchNumber: body.branchNumber,
        country: body.country,
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
    vendorType?: string;
    isNonResident?: boolean;
    branchNumber?: string;
    country?: string;
  };

  if (body.vendorType !== undefined) {
    const validVendorTypes = ["individual", "company"] as const;
    if (!validVendorTypes.includes(body.vendorType as typeof validVendorTypes[number])) {
      return NextResponse.json(
        { success: false, error: "vendorType must be 'individual' or 'company'" },
        { status: 400 }
      );
    }
  }

  if (body.isNonResident === true && !body.country) {
    return NextResponse.json(
      { success: false, error: "country is required when isNonResident is true" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(vendors)
    .set({
      taxId: body.taxId,
      name: body.name,
      address: body.address,
      defaultExpenseGl: body.defaultExpenseGl,
      defaultWhtRate: body.defaultWhtRate != null ? String(body.defaultWhtRate) : undefined,
      isActive: body.isActive,
      vendorType: body.vendorType,
      isNonResident: body.isNonResident,
      branchNumber: body.branchNumber,
      country: body.country,
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


