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
  role: z.enum(["admin", "maker", "checker"]).optional(),
});

export async function POST(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }

    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = await checkRateLimitAsync({ key: `auth-register:${ip}`, limit: 20, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json({ success: false, error: "Too many register attempts" }, { status: 429 });
    }

    const parsed = RegisterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
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
        data: { name: body.name || null, role: body.role || "maker" },
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });
    if (error) {
      console.error("[register] supabase error:", error.message);
      return NextResponse.json({ success: false, error: "Registration failed. Please try again." }, { status: 400 });
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
            role: body.role || "maker",
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
      { success: false, error: "Register failed" },
      { status: 500 }
    );
  }
}

