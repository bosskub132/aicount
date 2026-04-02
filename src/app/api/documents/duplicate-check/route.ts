import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const body = (await request.json()) as {
      tenantId: string;
      fileHash?: string;
      issuerTaxId?: string | null;
      documentNumber?: string | null;
      documentDate?: string | null;
      grandTotal?: string | number | null;
    };
    if (!body.tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    if (body.fileHash) {
      const exact = await db
        .select({
          id: documents.id,
          status: documents.status,
          fileHash: documents.fileHash,
        })
        .from(documents)
        .where(and(eq(documents.tenantId, body.tenantId), eq(documents.fileHash, body.fileHash)));
      if (exact.length) {
        return NextResponse.json({ success: true, data: { duplicate: true, mode: "file_hash", matches: exact } });
      }
    }

    const all = await db
      .select({
        id: documents.id,
        status: documents.status,
        issuerTaxId: documents.issuerTaxId,
        documentNumber: documents.documentNumber,
        documentDate: documents.documentDate,
        grandTotal: documents.grandTotal,
      })
      .from(documents)
      .where(eq(documents.tenantId, body.tenantId));

    const normalizedIssuer = String(body.issuerTaxId || "").replace(/\D/g, "");
    const normalizedDocNo = String(body.documentNumber || "").trim().toLowerCase();
    const normalizedDate = body.documentDate ? String(body.documentDate).slice(0, 10) : "";
    const targetTotal = Number(body.grandTotal || 0);

    const nearMatches = all.filter((row) => {
      const issuerOk =
        normalizedIssuer &&
        String(row.issuerTaxId || "")
          .replace(/\D/g, "")
          .includes(normalizedIssuer);
      const docNoOk =
        normalizedDocNo &&
        String(row.documentNumber || "")
          .trim()
          .toLowerCase() === normalizedDocNo;
      const dateOk = normalizedDate && String(row.documentDate || "").slice(0, 10) === normalizedDate;
      const totalOk = targetTotal > 0 && Math.abs(Number(row.grandTotal || 0) - targetTotal) <= 0.05;
      return (issuerOk && docNoOk) || (docNoOk && dateOk && totalOk);
    });

    return NextResponse.json({
      success: true,
      data: {
        duplicate: nearMatches.length > 0,
        mode: "heuristic",
        matches: nearMatches,
      },
    });
  } catch (error) {
    console.error("[documents/duplicate-check POST]", error);
    return NextResponse.json(
      { success: false, error: "Duplicate check failed" },
      { status: 500 }
    );
  }
}

