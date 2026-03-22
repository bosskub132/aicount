import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles, tenants } from "@/lib/db/schema";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function DELETE(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const body = (await request.json()) as {
      workspaceActions: Array<{
        tenantId: string;
        action: "transfer" | "delete";
        newOwnerId?: string;
      }>;
    };

    const now = new Date();
    const deletionScheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const wa of body.workspaceActions ?? []) {
      if (wa.action === "transfer" && wa.newOwnerId) {
        await db
          .update(tenants)
          .set({ ownerUserId: wa.newOwnerId, updatedAt: now })
          .where(eq(tenants.id, wa.tenantId));
      } else if (wa.action === "delete") {
        await db
          .update(tenants)
          .set({
            deletedAt: now,
            deletionScheduledFor,
            deletionReason: "account_deletion",
            updatedAt: now,
          })
          .where(eq(tenants.id, wa.tenantId));
      }
    }

    await db
      .update(profiles)
      .set({
        deletedAt: now,
        deletionScheduledFor,
        updatedAt: now,
      })
      .where(eq(profiles.id, ctx.userId));

    return NextResponse.json({
      success: true,
      data: { deletionScheduledFor },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Account deletion failed" },
      { status: 500 }
    );
  }
}
