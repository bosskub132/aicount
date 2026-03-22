import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles, tenants, tenantAssignments } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { validateCsrf } from "@/lib/api/csrf";

const DeleteAccountSchema = z.object({
  workspaceActions: z.array(
    z.object({
      tenantId: z.string().uuid(),
      action: z.enum(["transfer", "delete"]),
      newOwnerId: z.string().uuid().optional(),
    })
  ),
});

export async function DELETE(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }

    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const parsed = DeleteAccountSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const body = parsed.data;

    const now = new Date();
    const deletionScheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Verify ownership of every tenant before acting (outside transaction — read-only checks)
    for (const wa of body.workspaceActions ?? []) {
      const [tenant] = await db
        .select({ ownerUserId: tenants.ownerUserId })
        .from(tenants)
        .where(eq(tenants.id, wa.tenantId))
        .limit(1);

      if (!tenant || tenant.ownerUserId !== ctx.userId) {
        return forbidden("You are not the owner of this workspace");
      }

      if (wa.action === "transfer" && wa.newOwnerId) {
        // Verify new owner is a member
        const assignments = await db
          .select()
          .from(tenantAssignments)
          .where(
            and(
              eq(tenantAssignments.tenantId, wa.tenantId),
              eq(tenantAssignments.userId, wa.newOwnerId)
            )
          );
        if (assignments.length === 0) {
          return NextResponse.json(
            { success: false, error: "New owner must be a workspace member" },
            { status: 400 }
          );
        }
      }
    }

    await db.transaction(async (tx) => {
      for (const wa of body.workspaceActions ?? []) {
        if (wa.action === "transfer" && wa.newOwnerId) {
          await tx
            .update(tenants)
            .set({ ownerUserId: wa.newOwnerId, updatedAt: now })
            .where(eq(tenants.id, wa.tenantId));
        } else if (wa.action === "delete") {
          await tx
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

      await tx
        .update(profiles)
        .set({
          deletedAt: now,
          deletionScheduledFor,
          updatedAt: now,
        })
        .where(eq(profiles.id, ctx.userId));
    });

    return NextResponse.json({
      success: true,
      data: { deletionScheduledFor: deletionScheduledFor.toISOString() },
    });
  } catch (error) {
    console.error("[account-delete]", error);
    return NextResponse.json(
      { success: false, error: "Account deletion failed" },
      { status: 500 }
    );
  }
}
