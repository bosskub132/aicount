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

function mapSupabaseAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email or password is incorrect. Please double-check and try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Please verify your email before signing in. Check your inbox for the verification link.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Too many sign-in attempts. Please wait a minute and try again.";
  }
  if (m.includes("user not found")) {
    return "No account found for this email. Try signing up instead.";
  }
  return "Sign-in failed. Please try again.";
}

export async function POST(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json(
        { success: false, error: "Request blocked for security. Please reload the page and try again." },
        { status: 403 }
      );
    }

    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = await checkRateLimitAsync({ key: `auth-login:${ip}`, limit: 30, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json(
        { success: false, error: "Too many sign-in attempts. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    const parsed = LoginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email and password." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { success: false, error: mapSupabaseAuthError(error.message) },
        { status: 401 }
      );
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
      { success: false, error: "Something went wrong while signing in. Please try again." },
      { status: 500 }
    );
  }
}

