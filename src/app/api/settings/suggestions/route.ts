import { NextResponse } from "next/server";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const body = await request.json();
  const { suggestionsEnabled } = body;

  if (typeof suggestionsEnabled !== "boolean") {
    return NextResponse.json(
      { success: false, error: "suggestionsEnabled must be a boolean" },
      { status: 400 }
    );
  }

  await db
    .update(tenants)
    .set({ suggestionsEnabled, updatedAt: new Date() })
    .where(eq(tenants.id, ctx.tenantId));

  return NextResponse.json({ success: true });
}
