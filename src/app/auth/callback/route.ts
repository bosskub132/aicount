import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/utils/app-url";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const appUrl = getAppUrl();

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const assignments = await db
      .select({ id: tenantAssignments.id })
      .from(tenantAssignments)
      .where(eq(tenantAssignments.userId, user.id))
      .limit(1);

    if (assignments.length === 0) {
      return NextResponse.redirect(`${appUrl}/onboarding`);
    }
  }

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
