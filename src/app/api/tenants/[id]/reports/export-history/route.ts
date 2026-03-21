import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exportTemplateSelections } from "@/lib/db/schema";
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
    .from(exportTemplateSelections)
    .where(and(eq(exportTemplateSelections.tenantId, id)))
    .orderBy(desc(exportTemplateSelections.exportedAt));

  return NextResponse.json({ success: true, data: rows });
}

