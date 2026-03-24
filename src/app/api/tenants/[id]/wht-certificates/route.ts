import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
  ensureRole,
} from "@/lib/api/request-context";
import { listCertificates, getCertificateStats } from "@/lib/db/queries/wht-certificates";
import { generateCertificate } from "@/lib/services/wht-certificate";

const VALID_STATUSES = ["active", "voided", "all"] as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const url = new URL(request.url);
    const period = url.searchParams.get("period") || undefined;
    const search = (url.searchParams.get("search") || "").slice(0, 200) || undefined;
    const statusParam = url.searchParams.get("status") || "all";
    const status = VALID_STATUSES.includes(statusParam as typeof VALID_STATUSES[number])
      ? (statusParam as typeof VALID_STATUSES[number])
      : "all";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));

    const [result, stats] = await Promise.all([
      listCertificates(id, { period, search, status, page, limit }),
      period ? getCertificateStats(id, period) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      data: { rows: result.rows, total: result.total, stats },
    });
  } catch (error) {
    console.error("[WHT certificates GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to list WHT certificates" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
    if (!ensureRole(ctx.role, ["admin", "maker"])) {
      return forbidden("Only admin and maker can generate certificates");
    }

    const body = await request.json();
    const { documentId, paymentId, incomeType, whtRate } = body as {
      documentId?: string;
      paymentId?: string;
      incomeType?: string;
      whtRate?: number;
    };

    if (!documentId || typeof documentId !== "string") {
      return NextResponse.json(
        { success: false, error: "documentId is required" },
        { status: 400 },
      );
    }

    const result = await generateCertificate({
      tenantId: id,
      documentId,
      paymentId,
      incomeType,
      whtRate,
      issuedBy: ctx.userId,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("[WHT certificates POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate WHT certificate" },
      { status: 500 },
    );
  }
}
