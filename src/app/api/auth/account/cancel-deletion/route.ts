import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles, tenants } from "@/lib/db/schema";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { validateCsrf } from "@/lib/api/csrf";

export async function POST(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const [profile] = await db
      .select({ deletedAt: profiles.deletedAt })
      .from(profiles)
      .where(eq(profiles.id, ctx.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    if (!profile.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Account is not scheduled for deletion" },
        { status: 400 }
      );
    }

    await db
      .update(profiles)
      .set({
        deletedAt: null,
        deletionScheduledFor: null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, ctx.userId));

    await db
      .update(tenants)
      .set({
        deletedAt: null,
        deletionScheduledFor: null,
        deletionReason: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenants.ownerUserId, ctx.userId),
          eq(tenants.deletionReason, "account_deletion")
        )
      );

    return NextResponse.json({ success: true, data: { cancelled: true } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Cancel deletion failed" },
      { status: 500 }
    );
  }
}
