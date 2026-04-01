import { NextRequest, NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
} from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { crossTenantPatterns } from "@/lib/db/schema";
import { desc, like, eq, gte, count, and, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const patternType = searchParams.get("patternType")?.slice(0, 50);
  const search = searchParams.get("search")?.slice(0, 100);
  const minConfidence = searchParams.get("minConfidence")?.slice(0, 10);

  const conditions = [];
  if (patternType) conditions.push(eq(crossTenantPatterns.patternType, patternType));
  if (search) conditions.push(like(crossTenantPatterns.triggerKey, `%${search}%`));
  if (minConfidence) conditions.push(gte(crossTenantPatterns.confidence, minConfidence));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(crossTenantPatterns)
      .where(whereClause)
      .orderBy(desc(crossTenantPatterns.confidence))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: count() })
      .from(crossTenantPatterns)
      .where(whereClause),
  ]);

  return NextResponse.json({
    data: rows,
    total: totalResult[0]?.count ?? 0,
    page,
    limit,
  });
}
