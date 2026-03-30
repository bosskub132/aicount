import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { departments } from "@/lib/db/schema";

type DepartmentRow = {
  deptCode: string;
  deptName: string;
};

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
    const body = await request.json();
    const rows: DepartmentRow[] = body?.rows;

    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 5000) {
      return NextResponse.json(
        { success: false, error: "rows must be an array with 1-5000 items" },
        { status: 400 }
      );
    }

    const values = rows.map((row) => ({
      tenantId,
      deptCode: row.deptCode,
      deptName: row.deptName,
    }));

    const inserted = await db
      .insert(departments)
      .values(values)
      .onConflictDoUpdate({
        target: [departments.tenantId, departments.deptCode],
        set: {
          deptName: sql`excluded.dept_name`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(
      { success: true, data: { count: inserted.length } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Departments batch insert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import departments" },
      { status: 500 }
    );
  }
}
