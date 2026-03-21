import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Logout failed" },
      { status: 500 }
    );
  }
}
