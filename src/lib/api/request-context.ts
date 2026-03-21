import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";

export type RequestContext = {
  userId: string;
  userEmail: string | null;
  tenantId: string;
  role: "admin" | "maker" | "checker";
  ipAddress: string | null;
};

/**
 * Look up the user's effective role from tenant_assignments.
 * If they have both maker + checker assignments they are the workspace owner → "admin".
 */
export async function resolveUserRole(
  userId: string,
  tenantId: string
): Promise<RequestContext["role"]> {
  if (!tenantId || tenantId === "00000000-0000-0000-0000-000000000000") return "maker";
  try {
    const rows = await db
      .select({ role: tenantAssignments.role })
      .from(tenantAssignments)
      .where(
        and(
          eq(tenantAssignments.userId, userId),
          eq(tenantAssignments.tenantId, tenantId)
        )
      );
    const roles = rows.map((r) => r.role);
    if (roles.includes("maker") && roles.includes("checker")) return "admin";
    if (roles.includes("checker")) return "checker";
    if (roles.includes("maker")) return "maker";
  } catch {
    // fall through
  }
  return "maker";
}

export function getRequestContext(request: Request): RequestContext | null {
  const userId = request.headers.get("x-user-id");
  const userEmail = request.headers.get("x-user-email");
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role") as RequestContext["role"] | null;
  const ipAddress = request.headers.get("x-forwarded-for");

  if (userId && tenantId && role && ["admin", "maker", "checker"].includes(role)) {
    return {
      userId,
      userEmail,
      tenantId,
      role,
      ipAddress,
    };
  }

  // Local/dev fallback: allow routes to work even when client auth headers
  // are not wired yet. Production remains strict.
  if (process.env.NODE_ENV !== "production") {
    const url = new URL(request.url);
    const pathTenantId = url.pathname.match(/^\/api\/tenants\/([^/]+)/)?.[1] ?? null;
    const derivedTenantId = tenantId || url.searchParams.get("tenantId") || pathTenantId;
    const derivedRole =
      role === "admin" || role === "maker" || role === "checker" ? role : "admin";

    if (derivedTenantId) {
      return {
        userId: userId || "dev-user",
        userEmail: userEmail || null,
        tenantId: derivedTenantId,
        role: derivedRole,
        ipAddress,
      };
    }
  }

  return null;
}

export function unauthorized(message = "Missing or invalid auth context") {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

export function ensureRole(
  role: RequestContext["role"],
  allowed: Array<RequestContext["role"]>
) {
  return allowed.includes(role);
}

export function ensureTenantScope(ctxTenantId: string, requestedTenantId: string) {
  // If middleware couldn't derive tenant from URL (default placeholder),
  // trust the tenant ID provided in the request body/form.
  if (ctxTenantId === "00000000-0000-0000-0000-000000000000") return true;
  return ctxTenantId === requestedTenantId;
}

