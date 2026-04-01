import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureRole,
} from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    if (!ensureRole(ctx.role, ["admin"]))
      return forbidden("Admin access required");

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
  } catch (error) {
    console.error("Failed to update suggestion settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
