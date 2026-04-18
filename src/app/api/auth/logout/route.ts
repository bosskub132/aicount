import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/api/tenant";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });

    // Clear our tenant cookies
    response.cookies.set(WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set("workspaceTenantIdPublic", "", { path: "/", maxAge: 0 });

    // Defensively clear any leftover Supabase auth cookies directly on the
    // response. signOut() already writes cookie deletions via next/headers
    // cookies(), but mixing that path with response.cookies.set() can produce
    // inconsistent merges — clear here too so the browser gets a clean state.
    for (const cookie of request.headers.get("cookie")?.split(";") ?? []) {
      const name = cookie.split("=")[0]?.trim();
      if (name && name.startsWith("sb-")) {
        response.cookies.set(name, "", { path: "/", maxAge: 0 });
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
