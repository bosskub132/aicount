import { sql, and, eq, or, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
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

  let where = and(eq(vendors.tenantId, tenantId), eq(vendors.isActive, true));
  if (search) {
    where = and(where, or(ilike(vendors.name, `%${search}%`), ilike(vendors.taxId, `%${search}%`)));
  }

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(vendors).where(where);
  const total = Number(countResult.count);
  const rows = await db.select().from(vendors).where(where).limit(limit).offset(offset).orderBy(vendors.name);

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
    const cause = (error as { cause?: { code?: string } })?.cause;
    if (cause?.code === "23505") {
      return NextResponse.json({ success: false, error: "A vendor with this tax ID already exists." }, { status: 409 });
    }
    console.error("Vendor create error:", error);
    return NextResponse.json({ success: false, error: "Failed to create vendor." }, { status: 500 });
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


