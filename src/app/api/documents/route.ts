/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";

const SORT_FIELDS: Record<string, typeof documents.createdAt> = {
  createdAt: documents.createdAt,
  issuerName: documents.issuerName as any,
  grandTotal: documents.grandTotal as any,
  documentDate: documents.documentDate as any,
  status: documents.status as any,
};

export async function GET(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");

    const status = searchParams.get("status");
    const VALID_STATUSES = new Set(["DRAFT","OCR_PROCESSING","ACTION_REQUIRED","QUERY","PENDING_APPROVAL","APPROVED","EXPORTED","REJECTED","VOID"]);
    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }
    // Cap search length to prevent DB load
    const search = (searchParams.get("search")?.trim() || "").slice(0, 200) || undefined;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    const conditions = [eq(documents.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(documents.status, status as any));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(documents.issuerName, pattern),
          ilike(documents.documentNumber, pattern)
        ) as any
      );
    }

    const where = and(...conditions);
    const sortColumn = SORT_FIELDS[sort] || documents.createdAt;
    const orderBy = order === "asc" ? asc(sortColumn) : desc(sortColumn);
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(documents)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(documents)
        .where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[documents GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
