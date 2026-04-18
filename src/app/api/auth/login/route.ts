import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { validateCsrf } from "@/lib/api/csrf";
import { checkRateLimitAsync } from "@/lib/api/rate-limit";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";
import { WORKSPACE_COOKIE, workspaceCookieOptions } from "@/lib/api/tenant";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }

    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = await checkRateLimitAsync({ key: `auth-login:${ip}`, limit: 30, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json({ success: false, error: "Too many login attempts" }, { status: 429 });
    }

    const parsed = LoginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const body = parsed.data;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      data: {
        user: data.user,
        session: data.session
          ? {
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              expiresAt: data.session.expires_at,
            }
          : null,
      },
    });

    if (data.user) {
      try {
        const assignments = await db
          .select({ tenantId: tenantAssignments.tenantId })
          .from(tenantAssignments)
          .where(eq(tenantAssignments.userId, data.user.id));

        const uniqueTenantIds = Array.from(new Set(assignments.map((a) => a.tenantId)));
        if (uniqueTenantIds.length === 1) {
          const tenantId = uniqueTenantIds[0];
          response.cookies.set(WORKSPACE_COOKIE, tenantId, workspaceCookieOptions);
          response.cookies.set("workspaceTenantIdPublic", tenantId, {
            httpOnly: false,
            sameSite: "lax",
            path: "/",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 365,
          });
        }
      } catch (err) {
        console.error("[auth/login tenant cookie]", err);
      }
    }

    return response;
  } catch (error) {
    console.error("[auth/login POST]", error);
    return NextResponse.json(
      { success: false, error: "Invalid email or password" },
      { status: 500 }
    );
  }
}

