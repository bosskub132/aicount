import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";

export const WORKSPACE_COOKIE = "workspaceTenantId";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getTenantIdFromRequest(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(WORKSPACE_COOKIE);
  const raw = cookie?.value;

  if (!raw || !UUID_RE.test(raw) || raw === ZERO_UUID) {
    return null;
  }

  const rows = await db
    .select({ role: tenantAssignments.role })
    .from(tenantAssignments)
    .where(and(eq(tenantAssignments.userId, userId), eq(tenantAssignments.tenantId, raw)));

  if (rows.length === 0) {
    cookieStore.delete(WORKSPACE_COOKIE);
    return null;
  }

  return raw;
}

export const workspaceCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};
