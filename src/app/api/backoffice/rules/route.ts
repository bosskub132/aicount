import { NextResponse, type NextRequest } from "next/server";
import { and, eq, lt, gte, sql, count, desc, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiExtractionRules, tenants } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { searchParams } = new URL(request.url);
  const tenantFilter = searchParams.get("tenantId");
  const status = searchParams.get("status");
  const typeFilter = searchParams.get("type");
  const search = searchParams.get("search")?.slice(0, 200);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];

  if (tenantFilter) {
    conditions.push(eq(aiExtractionRules.tenantId, tenantFilter));
  }

  if (status === "graduated") {
    conditions.push(eq(aiExtractionRules.isGraduated, true));
  } else if (status === "prompt") {
    conditions.push(eq(aiExtractionRules.isGraduated, false));
    conditions.push(gte(aiExtractionRules.confidence, "0.50"));
  } else if (status === "low") {
    conditions.push(lt(aiExtractionRules.confidence, "0.50"));
  }

  if (typeFilter) {
    conditions.push(eq(aiExtractionRules.ruleType, typeFilter));
  }

  if (search) {
    conditions.push(
      or(
        ilike(aiExtractionRules.ruleText, `%${search}%`),
        ilike(aiExtractionRules.triggerValue, `%${search}%`),
        ilike(aiExtractionRules.fieldName, `%${search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rulesRows, statsRows] = await Promise.all([
    db
      .select({
        id: aiExtractionRules.id,
        tenantId: aiExtractionRules.tenantId,
        tenantName: tenants.name,
        ruleType: aiExtractionRules.ruleType,
        triggerKey: aiExtractionRules.triggerKey,
        triggerValue: aiExtractionRules.triggerValue,
        fieldName: aiExtractionRules.fieldName,
        ruleText: aiExtractionRules.ruleText,
        deterministicValue: aiExtractionRules.deterministicValue,
        sampleCount: aiExtractionRules.sampleCount,
        confidence: aiExtractionRules.confidence,
        isGraduated: aiExtractionRules.isGraduated,
        createdAt: aiExtractionRules.createdAt,
        updatedAt: aiExtractionRules.updatedAt,
      })
      .from(aiExtractionRules)
      .leftJoin(tenants, eq(aiExtractionRules.tenantId, tenants.id))
      .where(where)
      .orderBy(desc(aiExtractionRules.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({
        total: count(),
        graduated: sql<number>`COUNT(*) FILTER (WHERE ${aiExtractionRules.isGraduated} = true)::int`,
        prompt: sql<number>`COUNT(*) FILTER (WHERE ${aiExtractionRules.isGraduated} = false AND ${aiExtractionRules.confidence} >= '0.50')::int`,
        low: sql<number>`COUNT(*) FILTER (WHERE ${aiExtractionRules.confidence} < '0.50')::int`,
        tenantCount: sql<number>`COUNT(DISTINCT ${aiExtractionRules.tenantId})::int`,
      })
      .from(aiExtractionRules),
  ]);

  const stats = statsRows[0];

  // Count total matching rows for pagination
  const [countRow] = await db
    .select({ total: count() })
    .from(aiExtractionRules)
    .leftJoin(tenants, eq(aiExtractionRules.tenantId, tenants.id))
    .where(where);

  return NextResponse.json({
    success: true,
    data: rulesRows,
    meta: { total: Number(countRow?.total ?? 0), page, limit },
    stats: {
      total: Number(stats?.total ?? 0),
      graduated: Number(stats?.graduated ?? 0),
      prompt: Number(stats?.prompt ?? 0),
      low: Number(stats?.low ?? 0),
      tenantCount: Number(stats?.tenantCount ?? 0),
    },
  });
}
