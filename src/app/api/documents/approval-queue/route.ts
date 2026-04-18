import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";

export async function GET(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? ctx.tenantId;
    if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");

    const queue = await db
      .select()
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.status, "PENDING_APPROVAL")))
      .orderBy(desc(documents.updatedAt));

    return NextResponse.json({ success: true, data: queue });
  } catch (error) {
    console.error("[approval-queue GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch approval queue" },
      { status: 500 }
    );
  }
}

