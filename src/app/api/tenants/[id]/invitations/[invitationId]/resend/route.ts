import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { invitations } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId, invitationId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");

  try {
    // Find the invitation
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.tenantId, tenantId)));

    if (!invitation) {
      return NextResponse.json({ success: false, error: "Invitation not found" }, { status: 404 });
    }
    if (invitation.status !== "pending") {
      return NextResponse.json({ success: false, error: "Only pending invitations can be resent" }, { status: 400 });
    }

    // Regenerate token and extend expiry
    const newToken = crypto.randomBytes(32).toString("hex");
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [updated] = await db
      .update(invitations)
      .set({ token: newToken, expiresAt: newExpiry })
      .where(eq(invitations.id, invitationId))
      .returning();

    // TODO: Re-send email via Resend (skip for now — email service may not be configured on staging)

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Invitation resend error:", error);
    return NextResponse.json({ success: false, error: "Failed to resend invitation" }, { status: 500 });
  }
}
