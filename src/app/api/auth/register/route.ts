import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { validateCsrf } from "@/lib/api/csrf";
import { checkRateLimitAsync } from "@/lib/api/rate-limit";
import { getAppUrl } from "@/lib/utils/app-url";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().max(200).optional(),
});

function mapSupabaseSignUpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("user already")) {
    return "An account already exists for this email. Try signing in instead.";
  }
  if (m.includes("password") && m.includes("6 characters")) {
    return "Password must be at least 6 characters.";
  }
  if (m.includes("password")) {
    return "Password doesn't meet requirements. Choose a stronger password.";
  }
  if (m.includes("email") && (m.includes("invalid") || m.includes("not valid"))) {
    return "Please enter a valid email address.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many sign-up attempts. Please wait a few minutes and try again.";
  }
  return "Sign-up failed. Please try again.";
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
    const rate = await checkRateLimitAsync({ key: `auth-register:${ip}`, limit: 20, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json(
        { success: false, error: "Too many sign-up attempts. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    const parsed = RegisterSchema.safeParse(await request.json());
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      let msg = "Please check your details and try again.";
      if (firstIssue?.path[0] === "email") msg = "Please enter a valid email address.";
      else if (firstIssue?.path[0] === "password") msg = "Password must be at least 6 characters.";
      else if (firstIssue?.path[0] === "name") msg = "Name is too long (max 200 characters).";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    const body = parsed.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const appUrl = getAppUrl();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { name: body.name || null },
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });
    if (error) {
      console.error("[register] supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: mapSupabaseSignUpError(error.message) },
        { status: 400 }
      );
    }

    let profileSynced = false;
    if (data.user) {
      try {
        await db
          .insert(profiles)
          .values({
            id: data.user.id,
            email: data.user.email || body.email,
            name: body.name || null,
          })
          .onConflictDoNothing();
        profileSynced = true;
      } catch {
        profileSynced = false;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: data.user?.id || null,
        email: data.user?.email || body.email,
        profileSynced,
      },
    });
  } catch (error) {
    console.error("[auth/register POST]", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong while creating your account. Please try again." },
      { status: 500 }
    );
  }
}

