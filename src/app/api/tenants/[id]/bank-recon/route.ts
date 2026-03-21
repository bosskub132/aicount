import { and, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankStatements, documents } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);

  const [statements, journalDocs] = await Promise.all([
    db
      .select()
      .from(bankStatements)
      .where(and(eq(bankStatements.tenantId, id), gte(bankStatements.statementDate, from), lte(bankStatements.statementDate, to))),
    db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, id),
          eq(documents.status, "EXPORTED"),
          gte(documents.documentDate, from),
          lte(documents.documentDate, to)
        )
      ),
  ]);

  const statementAmounts = statements.flatMap((s) =>
    Array.isArray(s.lineItems)
      ? (s.lineItems as Array<Record<string, unknown>>).map((i) => Number(i.amount || 0))
      : []
  );
  const docAmounts = journalDocs.map((d) => Number(d.grandTotal || 0));

  const matched: Array<{ statementAmount: number; docAmount: number }> = [];
  const unmatchedStatements: number[] = [];
  const unmatchedDocs = [...docAmounts];

  for (const sAmount of statementAmounts) {
    const idx = unmatchedDocs.findIndex((dAmount) => Math.abs(dAmount - sAmount) <= 0.05);
    if (idx >= 0) {
      matched.push({ statementAmount: sAmount, docAmount: unmatchedDocs[idx] });
      unmatchedDocs.splice(idx, 1);
    } else {
      unmatchedStatements.push(sAmount);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      period: { from, to },
      matchedCount: matched.length,
      unmatchedStatementCount: unmatchedStatements.length,
      unmatchedDocCount: unmatchedDocs.length,
      matched,
      unmatchedStatements,
      unmatchedDocs,
    },
  });
}

