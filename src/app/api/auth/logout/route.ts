import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/api/tenant";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    const response = NextResponse.json({ success: true });
    response.cookies.set(WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set("workspaceTenantIdPublic", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[auth/logout POST]", error);
    return NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
  }
}
