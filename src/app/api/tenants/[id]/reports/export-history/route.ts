import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exportTemplateSelections, expressTemplates } from "@/lib/db/schema";
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
    .select({
      id: exportTemplateSelections.id,
      tenantId: exportTemplateSelections.tenantId,
      templateId: exportTemplateSelections.templateId,
      documentIds: exportTemplateSelections.documentIds,
      exportedAt: exportTemplateSelections.exportedAt,
      exportedBy: exportTemplateSelections.exportedBy,
      templateName: expressTemplates.name,
    })
    .from(exportTemplateSelections)
    .leftJoin(
      expressTemplates,
      eq(exportTemplateSelections.templateId, expressTemplates.id)
    )
    .where(and(eq(exportTemplateSelections.tenantId, id)))
    .orderBy(desc(exportTemplateSelections.exportedAt));

  const data = rows.map((row) => ({
    ...row,
    recordCount: Array.isArray(row.documentIds) ? row.documentIds.length : 0,
  }));

  return NextResponse.json({ success: true, data });
}

