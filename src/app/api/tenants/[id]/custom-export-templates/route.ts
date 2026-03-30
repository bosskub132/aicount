import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customExportTemplates } from "@/lib/db/schema";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";

type ColumnMapping = {
  position: number;
  header: string;
  sourceField: string;
  format?: string;
  defaultValue?: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId))
    return forbidden("Cross-tenant access denied");

  try {
    const rows = await db
      .select()
      .from(customExportTemplates)
      .where(eq(customExportTemplates.tenantId, tenantId));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Export templates GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load export templates." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId))
    return forbidden("Cross-tenant access denied");

  try {
    const body = (await request.json()) as {
      name: string;
      columnMappings: ColumnMapping[];
      isActive?: boolean;
    };

    if (!body.name || !Array.isArray(body.columnMappings)) {
      return NextResponse.json(
        { success: false, error: "Name and columnMappings are required." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(customExportTemplates)
      .values({
        tenantId,
        name: body.name,
        columnMappings: body.columnMappings,
        isActive: body.isActive ?? false,
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause;
    if (cause?.code === "23505") {
      return NextResponse.json(
        { success: false, error: "A template with this name already exists." },
        { status: 409 }
      );
    }
    console.error("Export templates POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create template." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId))
    return forbidden("Cross-tenant access denied");

  try {
    const body = (await request.json()) as {
      id: string;
      name?: string;
      columnMappings?: ColumnMapping[];
      isActive?: boolean;
    };

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Template id is required." },
        { status: 400 }
      );
    }

    // If activating this template, deactivate all others first
    if (body.isActive === true) {
      await db
        .update(customExportTemplates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(customExportTemplates.tenantId, tenantId),
            eq(customExportTemplates.isActive, true)
          )
        );
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.columnMappings !== undefined)
      updateFields.columnMappings = body.columnMappings;
    if (body.isActive !== undefined) updateFields.isActive = body.isActive;

    const [updated] = await db
      .update(customExportTemplates)
      .set(updateFields)
      .where(
        and(
          eq(customExportTemplates.id, body.id),
          eq(customExportTemplates.tenantId, tenantId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Template not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause;
    if (cause?.code === "23505") {
      return NextResponse.json(
        { success: false, error: "A template with this name already exists." },
        { status: 409 }
      );
    }
    console.error("Export templates PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update template." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId))
    return forbidden("Cross-tenant access denied");

  try {
    const body = (await request.json()) as { id: string };

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Template id is required." },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(customExportTemplates)
      .where(
        and(
          eq(customExportTemplates.id, body.id),
          eq(customExportTemplates.tenantId, tenantId)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Template not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("Export templates DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete template." },
      { status: 500 }
    );
  }
}
