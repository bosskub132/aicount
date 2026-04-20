import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Strip auth headers to prevent client-side injection
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-role");
  requestHeaders.delete("x-tenant-id");
  requestHeaders.delete("x-user-email");
  requestHeaders.delete("x-is-superadmin");

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

    const pathTenantIdMatch = request.nextUrl.pathname.match(/^\/api\/tenants\/([^/]+)/);
    const cookieTenantIdRaw = request.cookies.get("workspaceTenantId")?.value;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cookieTenantId =
      cookieTenantIdRaw && UUID_RE.test(cookieTenantIdRaw) ? cookieTenantIdRaw : undefined;

    // Resolve tenantId with fallback chain: cookie → default_tenant_id (if assigned) → oldest assignment
    let tenantId: string | undefined = cookieTenantId;
    let cookieFellBack = false;

    if (!tenantId) {
      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("default_tenant_id")
          .eq("id", user.id)
          .single();
        const defaultId = (profileRow as { default_tenant_id?: string | null } | null)
          ?.default_tenant_id;

        if (defaultId) {
          const { data: defaultAssignment } = await supabase
            .from("tenant_assignments")
            .select("tenant_id")
            .eq("user_id", user.id)
            .eq("tenant_id", defaultId)
            .limit(1);
          if (defaultAssignment && defaultAssignment.length > 0) {
            tenantId = defaultId;
            cookieFellBack = true;
          }
        }

        if (!tenantId) {
          const { data: oldest } = await supabase
            .from("tenant_assignments")
            .select("tenant_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1);
          if (oldest && oldest.length > 0) {
            tenantId = (oldest[0] as { tenant_id: string }).tenant_id;
            cookieFellBack = true;
          }
        }
      } catch {
        // Fall back to path param or placeholder below
      }
    }

    tenantId = tenantId || pathTenantIdMatch?.[1] || "00000000-0000-0000-0000-000000000000";

    // Resolve role from tenant_assignments for API routes (accurate role check)
    // For non-API routes, use metadata fallback (faster, role not critical for page rendering)
    let role: string = String(user.user_metadata?.role || "maker");
    if (isApiRoute && tenantId && tenantId !== "00000000-0000-0000-0000-000000000000") {
      try {
        const { data: assignments } = await supabase
          .from("tenant_assignments")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId);
        if (assignments && assignments.length > 0) {
          const roles = assignments.map((a: { role: string }) => a.role);
          if (roles.includes("maker") && roles.includes("checker")) {
            role = "admin";
          } else if (roles.includes("checker")) {
            role = "checker";
          } else if (roles.includes("maker")) {
            role = "maker";
          }
        }
      } catch {
        // Fall back to metadata role
      }
    }
    if (role !== "admin" && role !== "checker") role = "maker";

    // Superadmin check
    let isSuperadmin = false;
    if (isApiRoute || request.nextUrl.pathname.startsWith("/backoffice")) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_superadmin")
          .eq("id", user.id)
          .single();
        isSuperadmin = profile?.is_superadmin === true;
      } catch {
        // Default to not superadmin
      }
    }

    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-role", role);
    requestHeaders.set("x-tenant-id", tenantId);
    if (user.email) {
      requestHeaders.set("x-user-email", user.email);
    }
    requestHeaders.set("x-is-superadmin", String(isSuperadmin));

    const isBackofficeRoute = request.nextUrl.pathname.startsWith("/backoffice") ||
      request.nextUrl.pathname.startsWith("/api/backoffice");
    if (isBackofficeRoute && !isSuperadmin) {
      if (isApiRoute) {
        return NextResponse.json({ success: false, error: "Superadmin access required" }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Preserve cookies from auth refresh when re-creating the response
    const existingCookies = supabaseResponse.headers.getSetCookie();
    supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of existingCookies) {
      supabaseResponse.headers.append("set-cookie", cookie);
    }

    // Persist resolved tenant when falling back to default / oldest assignment
    if (cookieFellBack && tenantId && tenantId !== "00000000-0000-0000-0000-000000000000") {
      const cookieOpts = {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      };
      supabaseResponse.cookies.set("workspaceTenantId", tenantId, cookieOpts);
      supabaseResponse.cookies.set("workspaceTenantIdPublic", tenantId, { ...cookieOpts, httpOnly: false });
    }
  }

  const isInvitePage = request.nextUrl.pathname.startsWith("/invite");
  if (user && isAuthPage && !isInvitePage) {
    const url = request.nextUrl.clone();
    return NextResponse.redirect(url.origin + "/dashboard");
  }

  return supabaseResponse;
}
