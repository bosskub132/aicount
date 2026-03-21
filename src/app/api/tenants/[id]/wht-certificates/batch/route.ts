/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, between, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { generate50TawiFile } from "@/lib/services/wht-pdf";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const body = (await request.json()) as { yearMonth: string };
    const [year, month] = String(body.yearMonth || "").split("-").map(Number);
    if (!year || !month) {
      return NextResponse.json({ success: false, error: "yearMonth is required (YYYY-MM)" }, { status: 400 });
    }

    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, id),
          eq(documents.status, "APPROVED"),
          between(documents.documentDate, start, end)
        )
      );

    const generated: Array<{ documentId: string; path: string }> = [];
    for (const doc of rows) {
      const whtAmount = Number(doc.whtAmount || 0);
      if (whtAmount <= 0) continue;
      const rate = Number((doc.ocrRaw as any)?.wht?.rate || 0.03);
      const path = await generate50TawiFile({
        documentId: doc.id,
        vendorName: doc.issuerName,
        vendorTaxId: doc.issuerTaxId,
        amount: whtAmount,
        rate,
      });
      generated.push({ documentId: doc.id, path });
    }

    return NextResponse.json({
      success: true,
      data: {
        yearMonth: body.yearMonth,
        generatedCount: generated.length,
        generated,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Batch 50 Tawi generation failed" },
      { status: 500 }
    );
  }
}

