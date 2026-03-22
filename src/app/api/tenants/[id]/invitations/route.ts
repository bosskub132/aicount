import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { invitations, tenants } from "@/lib/db/schema";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { getAppUrl } from "@/lib/utils/app-url";
import { validateCsrf } from "@/lib/api/csrf";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;

  if (!ensureTenantScope(ctx.tenantId, tenantId) && !ensureRole(ctx.role, ["admin"])) {
    return forbidden("Cross-tenant access denied");
  }

  const rows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tenantId, tenantId));

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id: tenantId } = await context.params;

    if (!ensureRole(ctx.role, ["admin", "checker"])) {
      return forbidden("Only admin/checker can invite users");
    }

    const body = (await request.json()) as { email: string; role: "maker" | "checker" };
    if (!body.email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [created] = await db
      .insert(invitations)
      .values({
        tenantId,
        email: body.email.toLowerCase().trim(),
        role: body.role || "maker",
        invitedBy: ctx.userId,
        token,
        expiresAt,
      })
      .returning();

    const inviteUrl = `${getAppUrl()}/invite/${token}`;

    if (resend) {
      await resend.emails.send({
        from: "AiCount <noreply@aicount.app>",
        to: body.email,
        subject: `You've been invited to ${escapeHtml(tenant.name)} on AiCount`,
        html: `
          <h2>Workspace Invitation</h2>
          <p>You've been invited to join <strong>${escapeHtml(tenant.name)}</strong> on AiCount as a <strong>${escapeHtml(body.role)}</strong>.</p>
          <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#1e293b;color:#fff;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
          <p style="color:#64748b;font-size:13px;">This invitation expires in 7 days. If you don't have an account, you'll be prompted to register first.</p>
        `,
      });
    }

    return NextResponse.json({ success: true, data: { ...created, inviteUrl } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Invite failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id: tenantId } = await context.params;

    if (!ensureRole(ctx.role, ["admin", "checker"])) {
      return forbidden("Only admin/checker can revoke invitations");
    }

    const body = (await request.json()) as { invitationId: string };
    const [deleted] = await db
      .delete(invitations)
      .where(and(eq(invitations.id, body.invitationId), eq(invitations.tenantId, tenantId)))
      .returning();

    return NextResponse.json({ success: true, data: deleted ?? null });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
