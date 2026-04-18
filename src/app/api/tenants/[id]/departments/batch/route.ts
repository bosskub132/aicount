import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { departments } from "@/lib/db/schema";
import { mapPgError } from "@/lib/api/errors";

const DepartmentRowSchema = z.object({
  deptCode: z.string().min(1).max(50),
  deptName: z.string().min(1).max(200),
});

const DepartmentBatchSchema = z.object({
  rows: z.array(DepartmentRowSchema).min(1).max(5000),
});

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
    const parsed = DepartmentBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { rows } = parsed.data;

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
    return mapPgError(error, "Failed to import departments");
  }
}
