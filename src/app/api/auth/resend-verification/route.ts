import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimitAsync } from "@/lib/api/rate-limit";
import { getAppUrl } from "@/lib/utils/app-url";
import { validateCsrf } from "@/lib/api/csrf";

const ResendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json(
        { success: false, error: "Request blocked for security. Please reload the page and try again." },
        { status: 403 }
      );
    }
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = await checkRateLimitAsync({ key: `resend-verify:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please wait 15 minutes before requesting another verification email." },
        { status: 429 }
      );
    }

    const parsed = ResendVerificationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    const body = parsed.data;

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
