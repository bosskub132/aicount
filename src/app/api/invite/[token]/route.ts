import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invitations, tenantAssignments, tenants } from "@/lib/db/schema";
import { getRequestContext } from "@/lib/api/request-context";
import { WORKSPACE_COOKIE, workspaceCookieOptions } from "@/lib/api/tenant";

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
    return NextResponse.json(
      { success: false, error: "This invitation link is invalid. Ask the workspace admin to send a new one." },
      { status: 404 }
    );
  }

  if (invitation.status !== "pending") {
    const label = invitation.status === "accepted" ? "already accepted" : invitation.status;
    return NextResponse.json(
      { success: false, error: `This invitation has been ${label}. Ask the workspace admin to send a new one if you still need access.` },
      { status: 400 }
    );
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    return NextResponse.json(
      { success: false, error: "This invitation has expired. Ask the workspace admin to send a new one." },
      { status: 400 }
    );
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
      return NextResponse.json(
        { success: false, error: "This invitation link is invalid. Ask the workspace admin to send a new one." },
        { status: 404 }
      );
    }
    if (invitation.status !== "pending") {
      const label = invitation.status === "accepted" ? "already accepted" : invitation.status;
      return NextResponse.json(
        { success: false, error: `This invitation has been ${label}.` },
        { status: 400 }
      );
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, error: "This invitation has expired. Ask the workspace admin to send a new one." },
        { status: 400 }
      );
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

      const response = NextResponse.json({
        success: true,
        data: { tenantId: invitation.tenantId, role: invitation.role, accepted: true },
      });
      response.cookies.set(WORKSPACE_COOKIE, invitation.tenantId, workspaceCookieOptions);
      response.cookies.set("workspaceTenantIdPublic", invitation.tenantId, {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
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
      { success: false, error: "Couldn't accept the invitation. Please try again." },
      { status: 500 }
    );
  }
}
