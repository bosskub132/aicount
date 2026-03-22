import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getAppUrl } from "@/lib/utils/app-url";
import { validateCsrf } from "@/lib/api/csrf";

export async function POST(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rate = checkRateLimit({ key: `resend-verify:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json({ success: false, error: "Too many attempts" }, { status: 429 });
    }

    const body = (await request.json()) as { email: string };
    if (!body.email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: body.email,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });

    if (error) {
      console.error("[resend-verification] supabase error:", error.message);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[resend-verification]", error);
    // Still return success to prevent enumeration
    return NextResponse.json({ success: true });
  }
}
