import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/api/tenant";

const isProd = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });

    // Match original attributes so the browser replaces (deletes) the exact cookie
    response.cookies.set(WORKSPACE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isProd,
      maxAge: 0,
    });
    response.cookies.set("workspaceTenantIdPublic", "", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      secure: isProd,
      maxAge: 0,
    });

    // Defensively clear Supabase auth cookies — signOut writes them via
    // next/headers cookies(), but mixing that with NextResponse.cookies can
    // produce inconsistent merges. List every sb-* cookie from the request
    // and emit matching delete headers.
    for (const cookie of request.headers.get("cookie")?.split(";") ?? []) {
      const name = cookie.split("=")[0]?.trim();
      if (name && name.startsWith("sb-")) {
        response.cookies.set(name, "", {
          path: "/",
          maxAge: 0,
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
