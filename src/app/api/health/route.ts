import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "aicount",
    timestamp: new Date().toISOString(),
    checks: {
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseDbUrl: Boolean(process.env.SUPABASE_DB_URL),
      hasGoogleVisionKey: Boolean(process.env.GOOGLE_VISION_API_KEY),
      hasInngestKey: Boolean(process.env.INNGEST_EVENT_KEY),
    },
  });
}

