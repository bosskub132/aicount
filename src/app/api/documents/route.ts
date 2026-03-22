/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

const SORT_FIELDS: Record<string, typeof documents.createdAt> = {
  createdAt: documents.createdAt,
  issuerName: documents.issuerName as any,
  grandTotal: documents.grandTotal as any,
  documentDate: documents.documentDate as any,
  status: documents.status as any,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }

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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "List failed" },
      { status: 500 }
    );
  }
}
