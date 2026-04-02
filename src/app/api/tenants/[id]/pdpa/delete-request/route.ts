import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, tenants } from "@/lib/db/schema";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id) && !ensureRole(ctx.role, ["admin"])) {
      return forbidden("Cross-tenant access denied");
    }

    const body = (await request.json()) as { reason?: string };

    await db
      .update(documents)
      .set({
        issuerName: "ANONYMIZED",
        issuerTaxId: null,
        ocrRaw: { pdpa: "anonymized", at: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(documents.tenantId, id));

    await db
      .update(tenants)
      .set({ updatedAt: new Date() })
      .where(eq(tenants.id, id));

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "pdpa.delete_request.executed",
      entityType: "tenant",
      entityId: id,
      metadata: { reason: body.reason || null },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: { tenantId: id, action: "anonymized_documents" } });
  } catch (error) {
    console.error("[tenants/:id/pdpa/delete-request POST]", error);
    return NextResponse.json(
      { success: false, error: "PDPA delete request failed" },
      { status: 500 }
    );
  }
}

