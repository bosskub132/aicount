import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validateCsrf } from "@/lib/api/csrf";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function POST(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rate = checkRateLimit({ key: `auth-refresh:${ip}`, limit: 60, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json({ success: false, error: "Too many refresh attempts" }, { status: 429 });
    }

    const body = (await request.json()) as {
      refreshToken?: string;
    };
    if (!body.refreshToken) {
      return NextResponse.json({ success: false, error: "refreshToken required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: body.refreshToken,
    });
    if (error || !data.session) {
      return NextResponse.json({ success: false, error: error?.message || "Refresh failed" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 }
    );
  }
}

