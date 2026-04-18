import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";
import {
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { WORKSPACE_COOKIE, workspaceCookieOptions } from "@/lib/api/tenant";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch {
    return NextResponse.json(
      { success: false, error: "tenantId is required and must be a UUID" },
      { status: 400 }
    );
  }

  const rows = await db
    .select({ role: tenantAssignments.role })
    .from(tenantAssignments)
    .where(
      and(
        eq(tenantAssignments.userId, ctx.userId),
        eq(tenantAssignments.tenantId, parsed.tenantId)
      )
    );

  if (rows.length === 0) {
    return forbidden("No assignment for requested tenant");
  }

  const response = NextResponse.json({ success: true, data: { tenantId: parsed.tenantId } });
  response.cookies.set(WORKSPACE_COOKIE, parsed.tenantId, workspaceCookieOptions);
  response.cookies.set("workspaceTenantIdPublic", parsed.tenantId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
