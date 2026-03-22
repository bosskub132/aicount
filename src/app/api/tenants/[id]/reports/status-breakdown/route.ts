import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
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
      status: documents.status,
      count: sql<number>`count(*)::int`,
    })
    .from(documents)
    .where(and(eq(documents.tenantId, id), isNull(documents.deletedAt)))
    .groupBy(documents.status);

  return NextResponse.json({ success: true, data: rows });
}
