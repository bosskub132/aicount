import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invitations, profiles, tenantAssignments, tenants } from "@/lib/db/schema";
import { getRequestContext } from "@/lib/api/request-context";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const [invitation] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      tenantId: invitations.tenantId,
      tenantName: tenants.name,
    })
    .from(invitations)
    .innerJoin(tenants, eq(invitations.tenantId, tenants.id))
    .where(eq(invitations.token, token))
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ success: false, error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json({ success: false, error: `Invitation already ${invitation.status}` }, { status: 400 });
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    return NextResponse.json({ success: false, error: "Invitation has expired" }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: invitation });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const ctx = getRequestContext(request);

    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ success: false, error: "Invitation not found" }, { status: 404 });
    }
    if (invitation.status !== "pending") {
      return NextResponse.json({ success: false, error: `Invitation already ${invitation.status}` }, { status: 400 });
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ success: false, error: "Invitation has expired" }, { status: 400 });
    }

    // If user is logged in, accept directly
    if (ctx) {
      await db.insert(tenantAssignments).values({
        tenantId: invitation.tenantId,
        userId: ctx.userId,
        role: invitation.role,
      }).onConflictDoNothing();

      await db
        .update(invitations)
        .set({ status: "accepted" })
        .where(eq(invitations.id, invitation.id));

      // Mark onboarding complete for invited users
      await db
        .update(profiles)
        .set({ isOnboardingComplete: true, updatedAt: new Date() })
        .where(eq(profiles.id, ctx.userId));

      return NextResponse.json({
        success: true,
        data: { tenantId: invitation.tenantId, role: invitation.role, accepted: true },
      });
    }

    // If not logged in, tell client to redirect to signup
    return NextResponse.json({
      success: true,
      data: {
        requiresAuth: true,
        email: invitation.email,
        tenantId: invitation.tenantId,
      },
    });
  } catch (error) {
    console.error("[invite/:token POST]", error);
    return NextResponse.json(
      { success: false, error: "Accept failed" },
      { status: 500 }
    );
  }
}
