import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiExtractionRules } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  // Build update object dynamically — only include fields present in body
  const updateData: Record<string, unknown> = { updatedAt: sql`now()` };

  if ("ruleText" in body && typeof body.ruleText === "string") {
    updateData.ruleText = body.ruleText;
  }
  if ("deterministicValue" in body) {
    updateData.deterministicValue =
      body.deterministicValue === null ? null : String(body.deterministicValue);
  }
  if ("isGraduated" in body && typeof body.isGraduated === "boolean") {
    updateData.isGraduated = body.isGraduated;
  }
  if ("confidence" in body && (typeof body.confidence === "string" || typeof body.confidence === "number")) {
    updateData.confidence = String(body.confidence);
  }

  const updated = await db
    .update(aiExtractionRules)
    .set(updateData)
    .where(eq(aiExtractionRules.id, id))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ success: false, error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated[0] });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { id } = await params;

  const deleted = await db
    .delete(aiExtractionRules)
    .where(eq(aiExtractionRules.id, id))
    .returning({ id: aiExtractionRules.id });

  if (deleted.length === 0) {
    return NextResponse.json({ success: false, error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
