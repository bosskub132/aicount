import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Stale/invalid refresh token — treat as unauthenticated.
    // Clear the bad cookies so the user can log in fresh.
  }

  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/invite");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/callback");
  const isVerifyEmailPage = request.nextUrl.pathname.startsWith("/signup/verify-email");

  if (!user && !isAuthPage && !isApiRoute && !isAuthCallback) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const isResendVerifyRoute = request.nextUrl.pathname === "/api/auth/resend-verification";
    if (!user.email_confirmed_at && !isAuthPage && !isAuthCallback && !isVerifyEmailPage && !isResendVerifyRoute) {
      if (isApiRoute) {
        return NextResponse.json({ success: false, error: "Email not verified" }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/signup/verify-email";
      if (user.email) {
        url.searchParams.set("email", user.email);
      }
      return NextResponse.redirect(url);
    }

    const roleRaw = String(user.user_metadata?.role || "maker");
    const role = roleRaw === "admin" || roleRaw === "checker" ? roleRaw : "maker";
    const pathTenantIdMatch = request.nextUrl.pathname.match(/^\/api\/tenants\/([^/]+)/);
    const queryTenantId = request.nextUrl.searchParams.get("tenantId");
    const tenantId =
      request.headers.get("x-tenant-id") ||
      pathTenantIdMatch?.[1] ||
      queryTenantId ||
      "00000000-0000-0000-0000-000000000000";

    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-role", role);
    requestHeaders.set("x-tenant-id", tenantId);
    if (user.email) {
      requestHeaders.set("x-user-email", user.email);
    }

    // Preserve cookies from auth refresh when re-creating the response
    const existingCookies = supabaseResponse.headers.getSetCookie();
    supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of existingCookies) {
      supabaseResponse.headers.append("set-cookie", cookie);
    }
  }

  const isInvitePage = request.nextUrl.pathname.startsWith("/invite");
  if (user && isAuthPage && !isInvitePage) {
    const url = request.nextUrl.clone();
    return NextResponse.redirect(url.origin + "/dashboard");
  }

  return supabaseResponse;
}
