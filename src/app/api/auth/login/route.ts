import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateCsrf } from "@/lib/api/csrf";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function POST(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rate = checkRateLimit({ key: `auth-login:${ip}`, limit: 30, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json({ success: false, error: "Too many login attempts" }, { status: 429 });
    }

    const body = (await request.json()) as { email: string; password: string };
    if (!body.email || !body.password) {
      return NextResponse.json({ success: false, error: "email and password required" }, { status: 400 });
    }

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

    return NextResponse.json({
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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Login failed" },
      { status: 500 }
    );
  }
}

