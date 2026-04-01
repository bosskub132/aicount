import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { getPendingDuplicates } from "@/lib/db/queries/duplicates";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id: documentId } = await context.params;

  const [doc] = await db
    .select({ tenantId: documents.tenantId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    return NextResponse.json(
      { success: false, error: "Document not found" },
      { status: 404 }
    );
  }

  if (!ensureTenantScope(ctx.tenantId, doc.tenantId)) {
    return forbidden("Cross-tenant access denied");
  }

  const duplicates = await getPendingDuplicates(documentId);

  return NextResponse.json({ success: true, data: duplicates });
}
