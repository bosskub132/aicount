import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/api/tenant";

const isProd = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });

    // Use delete with full attribute match so the browser truly removes the
    // cookie (not just empties its value). Mismatched attrs = browser treats
    // delete as a different cookie and keeps the original.
    response.cookies.delete({
      name: WORKSPACE_COOKIE,
      path: "/",
      sameSite: "lax",
      secure: isProd,
      httpOnly: true,
    });
    response.cookies.delete({
      name: "workspaceTenantIdPublic",
      path: "/",
      sameSite: "lax",
      secure: isProd,
      httpOnly: false,
    });

    // Defensively clear any Supabase auth cookies. signOut writes via
    // next/headers cookies(), which can miss the response if we build it
    // separately — so emit explicit deletes here.
    for (const cookie of request.headers.get("cookie")?.split(";") ?? []) {
      const name = cookie.split("=")[0]?.trim();
      if (name && name.startsWith("sb-")) {
        response.cookies.delete({
          name,
          path: "/",
          sameSite: "lax",
          secure: isProd,
        });
      }
    }

    return response;
  } catch (error) {
    console.error("[auth/logout POST]", error);
    return NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
  }
}
