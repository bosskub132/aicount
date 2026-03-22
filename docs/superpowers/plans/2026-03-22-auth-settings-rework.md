# Auth, Onboarding, Settings & Account Management Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring AICount's auth, onboarding, settings, and account management to production-grade quality with proper email verification, dedicated onboarding pages, a SaaS-quality settings panel, and soft-delete for accounts/workspaces.

**Architecture:** Sequential rework in 4 workstreams: (1) fix auth foundations (callback, email verification, URL consolidation), (2) replace onboarding modal with dedicated route-based pages, (3) overhaul settings with sidebar navigation and restructured routes, (4) add soft-delete with 30-day grace period for accounts and workspaces. Each workstream builds on the previous.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase SSR auth, Drizzle ORM (PostgreSQL), Inngest (background jobs), Resend (email), Zod v4 (validation), Lucide React (icons)

**Spec:** `docs/superpowers/specs/2026-03-22-auth-settings-rework-design.md`

---

## File Structure

### New Files

```
src/
  lib/
    utils/
      app-url.ts                          # Centralized app URL helper
  app/
    api/
      auth/
        resend-verification/
          route.ts                        # Resend email verification
    auth/
      callback/
        route.ts                          # Supabase email confirmation handler
    (auth)/
      signup/
        verify-email/
          page.tsx                        # "Check your email" page
      account-deleted/
        page.tsx                          # "Account scheduled for deletion" page
    (onboarding)/
      layout.tsx                          # Onboarding layout with stepper
      onboarding/
        page.tsx                          # Welcome page
        workspace/
          page.tsx                        # Create workspace step
        chart-of-accounts/
          page.tsx                        # COA step
        departments/
          page.tsx                        # Departments step
        team/
          page.tsx                        # Invite team step
        template/
          page.tsx                        # Export template step
        complete/
          page.tsx                        # Completion page
    (app)/
      settings/
        layout.tsx                        # Settings layout with sidebar nav
        profile/
          page.tsx                        # Profile settings
        security/
          page.tsx                        # Change password
        delete-account/
          page.tsx                        # Account deletion flow
        workspace/
          general/
            page.tsx                      # Workspace general settings
          members/
            page.tsx                      # Members & roles management
          invitations/
            page.tsx                      # Invitations management
          delete/
            page.tsx                      # Workspace deletion flow
        masterdata/
          coa/
            page.tsx                      # Chart of accounts (migrated)
          vendors/
            page.tsx                      # Vendors (migrated)
          customers/
            page.tsx                      # Customers (migrated)
          products/
            page.tsx                      # Products (migrated)
          departments/
            page.tsx                      # Departments (migrated)
        accounting/
          templates/
            page.tsx                      # Export templates (migrated)
          period-locks/
            page.tsx                      # Period locks (migrated)
          bank-recon/
            page.tsx                      # Bank reconciliation (migrated)
          tax-reports/
            page.tsx                      # Tax reports (migrated)
    api/
      auth/
        account/
          route.ts                        # DELETE: initiate account deletion
          cancel-deletion/
            route.ts                      # POST: cancel account deletion
      tenants/
        [id]/
          cancel-deletion/
            route.ts                      # POST: cancel workspace deletion
          transfer-ownership/
            route.ts                      # POST: transfer workspace ownership
  lib/
    inngest/
      functions/
        workspace-purge.ts               # Scheduled workspace hard delete
        account-purge.ts                  # Scheduled account hard delete
```

### Modified Files

```
src/lib/utils/app-url.ts                 # New utility
src/lib/db/schema.ts                     # Add onboardingStep, deletion columns
src/lib/supabase/middleware.ts           # Email verification, onboarding redirect, deletion checks
src/app/api/auth/register/route.ts       # Use getAppUrl()
src/app/api/auth/profile/route.ts        # Accept onboardingStep in PATCH
src/app/api/tenants/[id]/route.ts        # Add soft delete via PATCH
src/app/api/tenants/[id]/invitations/route.ts  # Use getAppUrl()
src/app/(app)/layout.tsx                 # Remove onboarding modal, add deletion banner
```

### Deleted Files

```
src/components/onboarding-modal.tsx       # Replaced by dedicated pages
src/app/(app)/settings/page.tsx           # Replaced by settings/layout.tsx + profile/page.tsx
src/app/(app)/settings/tenants/           # Entire directory — migrated to new routes
```

---

## Task 1: App URL Utility

**Files:**
- Create: `src/lib/utils/app-url.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/tenants/[id]/invitations/route.ts`

- [ ] **Step 1: Create `getAppUrl()` utility**

```ts
// src/lib/utils/app-url.ts
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://aicount-mocha.vercel.app";
}
```

- [ ] **Step 2: Update register route to use `getAppUrl()`**

In `src/app/api/auth/register/route.ts`, replace line 35:
```ts
// Before:
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aicount-mocha.vercel.app";

// After:
import { getAppUrl } from "@/lib/utils/app-url";
// ... inside POST handler:
const appUrl = getAppUrl();
```

- [ ] **Step 3: Update invitations route to use `getAppUrl()`**

In `src/app/api/tenants/[id]/invitations/route.ts`, replace line 10:
```ts
// Before:
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aicount-mocha.vercel.app";

// After:
import { getAppUrl } from "@/lib/utils/app-url";
// ... and replace APP_URL usage with getAppUrl()
```

- [ ] **Step 4: Search for any other hardcoded app URLs**

Run: `grep -r "aicount-mocha.vercel.app\|NEXT_PUBLIC_APP_URL" src/ --include="*.ts" --include="*.tsx"`

Replace any remaining hardcoded URLs with `getAppUrl()`.

- [ ] **Step 5: Verify build passes**

Run: `npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/app-url.ts src/app/api/auth/register/route.ts src/app/api/tenants/\[id\]/invitations/route.ts
git commit -m "refactor: consolidate app URL into getAppUrl() utility"
```

---

## Task 2: Auth Callback Route

**Files:**
- Create: `src/app/auth/callback/route.ts`

This route lives outside both `(auth)` and `(app)` route groups — it's a pure server-side redirect handler that processes Supabase email confirmation links.

- [ ] **Step 1: Create the callback route**

```ts
// src/app/auth/callback/route.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
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

  // Check if user has completed onboarding
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const [profile] = await db
      .select({ isOnboardingComplete: profiles.isOnboardingComplete })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (profile && !profile.isOnboardingComplete) {
      return NextResponse.redirect(`${appUrl}/onboarding`);
    }
  }

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat: add auth callback route for Supabase email verification"
```

---

## Task 3: Verify Email Page

**Files:**
- Create: `src/app/(auth)/signup/verify-email/page.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create the verify-email page**

```tsx
// src/app/(auth)/signup/verify-email/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowLeft, RefreshCw } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setResent(true);
    } catch {
      // silently fail — user can try again
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <Mail className="h-6 w-6 text-blue-600" />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Check your email</h1>
      <p className="mb-6 text-sm text-slate-500">
        We sent a verification link to{" "}
        <span className="font-medium text-slate-700">{email || "your email"}</span>.
        Click the link to verify your account.
      </p>

      {resent ? (
        <p className="mb-4 text-sm text-green-600">Verification email resent!</p>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending || !email}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
          Resend verification email
        </button>
      )}

      <div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update signup page to redirect to verify-email**

In `src/app/(auth)/signup/page.tsx`, find the success handler in the form submission. Currently it redirects to `/login`. Change it to redirect to `/signup/verify-email?email=<encoded_email>`.

Find the block that does `router.push("/login")` (or `router.push(\`/login?invite=${invite}\`)`) on successful registration. Replace with:

```ts
// After successful registration, redirect to verify-email page
if (invite) {
  router.push(`/login?invite=${invite}`);
} else {
  router.push(`/signup/verify-email?email=${encodeURIComponent(body.email)}`);
}
```

Note: If there's an invite token, we still redirect to login since invited users have a different flow.

- [ ] **Step 3: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/signup/verify-email/page.tsx src/app/\(auth\)/signup/page.tsx
git commit -m "feat: add verify-email page and redirect after signup"
```

---

## Task 3b: Resend Verification Email API

**Files:**
- Create: `src/app/api/auth/resend-verification/route.ts`

Task 3 creates a verify-email page that calls `POST /api/auth/resend-verification`. This task creates that API endpoint.

- [ ] **Step 1: Create the resend-verification route**

```ts
// src/app/api/auth/resend-verification/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getAppUrl } from "@/lib/utils/app-url";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rate = checkRateLimit({ key: `resend-verify:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rate.ok) {
      return NextResponse.json({ success: false, error: "Too many attempts" }, { status: 429 });
    }

    const body = (await request.json()) as { email: string };
    if (!body.email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: body.email,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Resend failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/resend-verification/route.ts
git commit -m "feat: add resend email verification API endpoint"
```

---

## Task 4: Middleware — Email Verification Check

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Add email verification check to middleware**

In `src/lib/supabase/middleware.ts`, after getting the user (line 31), add email verification check. The updated middleware should follow this priority chain:

```ts
// After: const { data: { user } } = await supabase.auth.getUser();

const isApiRoute = request.nextUrl.pathname.startsWith("/api");
const isAuthPage =
  request.nextUrl.pathname.startsWith("/login") ||
  request.nextUrl.pathname.startsWith("/signup") ||
  request.nextUrl.pathname.startsWith("/invite");
const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/callback");
const isOnboardingPage = request.nextUrl.pathname.startsWith("/onboarding");

// 1. Unauthenticated users → login (except auth/api/callback pages)
if (!user && !isAuthPage && !isApiRoute && !isAuthCallback) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

if (user) {
  // 2. Email verification check
  const isVerifyEmailPage = request.nextUrl.pathname.startsWith("/signup/verify-email");
  if (!user.email_confirmed_at && !isAuthPage && !isApiRoute && !isAuthCallback && !isVerifyEmailPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup/verify-email";
    url.searchParams.set("email", user.email || "");
    return NextResponse.redirect(url);
  }

  // Existing role/tenant header logic — preserve exactly as-is (lines 46-67 of current middleware)
  const roleRaw = String(user.user_metadata?.role || "maker");
  const role = roleRaw === "admin" || roleRaw === "checker" ? roleRaw : "maker";
  const pathTenantIdMatch = request.nextUrl.pathname.match(/^\/api\/tenants\/([^/]+)/);
  const tenantId =
    request.headers.get("x-tenant-id") ||
    pathTenantIdMatch?.[1] ||
    request.nextUrl.searchParams.get("tenantId") ||
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

  // Redirect authenticated users away from auth pages (except invite)
  const isInvitePage = request.nextUrl.pathname.startsWith("/invite");
  if (isAuthPage && !isInvitePage) {
    const url = request.nextUrl.clone();
    return NextResponse.redirect(url.origin + "/dashboard");
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat: add email verification enforcement in middleware"
```

---

## Task 5: Database Migration — Onboarding Step

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/app/api/auth/profile/route.ts`

- [ ] **Step 1: Add `onboardingStep` to profiles schema**

In `src/lib/db/schema.ts`, add to the `profiles` table definition (after `isOnboardingComplete`):

```ts
onboardingStep: integer("onboarding_step").default(0).notNull(),
```

- [ ] **Step 2: Update profile PATCH to accept `onboardingStep`**

In `src/app/api/auth/profile/route.ts`, update the PATCH handler:

```ts
const body = (await request.json()) as {
  name?: string;
  isOnboardingComplete?: boolean;
  onboardingStep?: number;
};

const updates: Record<string, unknown> = { updatedAt: new Date() };
if (body.name !== undefined) updates.name = body.name;
if (body.isOnboardingComplete !== undefined) updates.isOnboardingComplete = body.isOnboardingComplete;
if (body.onboardingStep !== undefined) updates.onboardingStep = body.onboardingStep;
```

Also add `onboardingStep` to the GET handler's select and the PATCH returning clause:

```ts
// In GET select:
onboardingStep: profiles.onboardingStep,

// In PATCH returning:
onboardingStep: profiles.onboardingStep,
```

- [ ] **Step 3: Generate and apply migration**

Run: `npx drizzle-kit generate`
Then: `npx drizzle-kit push` (or apply via Supabase migration)

- [ ] **Step 4: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/app/api/auth/profile/route.ts supabase/migrations/
git commit -m "feat: add onboardingStep column to profiles table"
```

---

## Task 6: Onboarding Layout

**Files:**
- Create: `src/app/(onboarding)/layout.tsx`

- [ ] **Step 1: Create onboarding layout with stepper**

```tsx
// src/app/(onboarding)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const STEPS = [
  { path: "/onboarding", label: "Welcome" },
  { path: "/onboarding/workspace", label: "Workspace" },
  { path: "/onboarding/chart-of-accounts", label: "Accounts" },
  { path: "/onboarding/departments", label: "Departments" },
  { path: "/onboarding/team", label: "Team" },
  { path: "/onboarding/template", label: "Template" },
  { path: "/onboarding/complete", label: "Complete" },
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentStepIndex = STEPS.findIndex((s) => s.path === pathname);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Progress bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-800">
                AiCount Setup
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
          </div>

          {/* Step indicators */}
          <div className="mt-4 flex items-center gap-1">
            {STEPS.map((step, i) => (
              <div key={step.path} className="flex flex-1 items-center">
                <div
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    i < currentStepIndex
                      ? "bg-blue-500"
                      : i === currentStepIndex
                        ? "bg-blue-500"
                        : "bg-slate-200"
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Step labels (desktop only) */}
          <div className="mt-2 hidden items-center md:flex">
            {STEPS.map((step, i) => (
              <div key={step.path} className="flex-1 text-center">
                <span
                  className={`text-xs ${
                    i <= currentStepIndex
                      ? "font-medium text-blue-600"
                      : "text-slate-400"
                  }`}
                >
                  {i < currentStepIndex && (
                    <Check className="mr-0.5 inline h-3 w-3" />
                  )}
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(onboarding\)/layout.tsx
git commit -m "feat: add onboarding layout with progress stepper"
```

---

## Task 7: Onboarding Pages — Welcome & Workspace

**Files:**
- Create: `src/app/(onboarding)/onboarding/page.tsx`
- Create: `src/app/(onboarding)/onboarding/workspace/page.tsx`

- [ ] **Step 1: Create welcome page**

```tsx
// src/app/(onboarding)/onboarding/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { Building2, FileText, Users, ArrowRight } from "lucide-react";

export default function OnboardingWelcomePage() {
  const router = useRouter();

  async function handleStart() {
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: 1 }),
    });
    router.push("/onboarding/workspace");
  }

  return (
    <div className="text-center">
      <h1 className="mb-3 text-2xl font-bold text-slate-900">
        Welcome to AiCount
      </h1>
      <p className="mb-8 text-sm text-slate-500">
        Let&apos;s set up your workspace in a few quick steps.
      </p>

      <div className="mb-8 grid gap-4 text-left sm:grid-cols-3">
        {[
          {
            icon: Building2,
            title: "Create Workspace",
            desc: "Set up your company profile and tax information",
          },
          {
            icon: FileText,
            title: "Configure Accounts",
            desc: "Import your chart of accounts and departments",
          },
          {
            icon: Users,
            title: "Invite Team",
            desc: "Add team members and assign roles",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <Icon className="mb-2 h-5 w-5 text-blue-600" />
            <h3 className="mb-1 text-sm font-medium text-slate-900">
              {title}
            </h3>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={handleStart}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Let&apos;s get started
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create workspace page**

This page is based on step 0 of the existing `onboarding-modal.tsx`. Extracts the workspace creation form.

```tsx
// src/app/(onboarding)/onboarding/workspace/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowLeft, ArrowRight } from "lucide-react";

export default function OnboardingWorkspacePage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existingTenantId, setExistingTenantId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user already has a tenant
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          const tenant = json.data[0];
          setExistingTenantId(tenant.id);
          setCompanyName(tenant.name || "");
          setTaxId(tenant.taxId || "");
        }
      })
      .catch(() => {});
  }, []);

  async function handleNext() {
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }
    if (taxId && taxId.length !== 13) {
      setError("Tax ID must be 13 digits");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let tenantId = existingTenantId;

      if (tenantId) {
        // Update existing tenant
        await fetch(`/api/tenants/${tenantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: companyName.trim(), taxId: taxId.trim() }),
        });
      } else {
        // Create new tenant
        const res = await fetch("/api/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: companyName.trim(), taxId: taxId.trim() }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to create workspace");
        tenantId = json.data.id;
      }

      // Save tenantId to localStorage for workspace selector
      if (tenantId) {
        localStorage.setItem("workspaceTenantId", tenantId);
      }

      // Advance onboarding step
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingStep: 2 }),
      });

      router.push("/onboarding/chart-of-accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Create your workspace</h1>
      <p className="mb-6 text-sm text-slate-500">
        This is your company&apos;s accounting workspace.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Company Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. บริษัท ตัวอย่าง จำกัด"
              className="w-full rounded-md border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Tax ID (เลขประจำตัวผู้เสียภาษี)
          </label>
          <input
            type="text"
            value={taxId}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 13);
              setTaxId(v);
            }}
            placeholder="13-digit tax identification number"
            maxLength={13}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-400">{taxId.length}/13 digits</p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/onboarding")}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Next"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(onboarding\)/onboarding/page.tsx src/app/\(onboarding\)/onboarding/workspace/page.tsx
git commit -m "feat: add onboarding welcome and workspace pages"
```

---

## Task 8: Onboarding Pages — COA, Departments, Team, Template

**Files:**
- Create: `src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx`
- Create: `src/app/(onboarding)/onboarding/departments/page.tsx`
- Create: `src/app/(onboarding)/onboarding/team/page.tsx`
- Create: `src/app/(onboarding)/onboarding/template/page.tsx`

These pages extract the corresponding step logic from `src/components/onboarding-modal.tsx` into standalone pages. Each step follows the same pattern: form with data entry, "Skip for now" link, Next/Back buttons.

- [ ] **Step 1: Create chart-of-accounts page**

Extract step 1 logic from `onboarding-modal.tsx`. The page lets users add account entries (code, name, category). Uses the same API: `POST /api/tenants/[tenantId]/coa`. Reads `tenantId` from `localStorage.getItem("workspaceTenantId")`.

Key structure:
```tsx
// src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx
"use client";
// Form with: accountCode (varchar), accountName (text), category (select: asset/liability/equity/revenue/expense)
// Table showing added accounts
// "I'll do this later" skip link → advances to step 3, navigates to /onboarding/departments
// Next button → saves accounts, advances to step 3, navigates to /onboarding/departments
// Back button → navigates to /onboarding/workspace
```

- [ ] **Step 2: Create departments page**

Extract step 2 logic from `onboarding-modal.tsx`. Lets users add departments (code, name). Uses `POST /api/tenants/[tenantId]/departments`.

Key structure:
```tsx
// src/app/(onboarding)/onboarding/departments/page.tsx
"use client";
// Form with: departmentCode (varchar), departmentName (text)
// Table showing added departments
// "I'll do this later" skip link → advances to step 4, navigates to /onboarding/team
// Next/Back buttons
```

- [ ] **Step 3: Create team invite page**

Extract step 3 logic from `onboarding-modal.tsx`. Lets users invite team members by email with role selection. Uses `POST /api/tenants/[tenantId]/invitations`.

Key structure:
```tsx
// src/app/(onboarding)/onboarding/team/page.tsx
"use client";
// Form with: email (text), role (select: maker/checker)
// List of sent invitations
// "I'll do this later" skip link → advances to step 5, navigates to /onboarding/template
// Next/Back buttons
```

- [ ] **Step 4: Create template selection page**

Extract step 4 logic from `onboarding-modal.tsx`. Lets users choose between default Express template or custom.

Key structure:
```tsx
// src/app/(onboarding)/onboarding/template/page.tsx
"use client";
// Radio group: "Default Express Template" / "Custom Template"
// If custom: template name input
// Next button → saves selection, advances to step 6, navigates to /onboarding/complete
// Back button → navigates to /onboarding/team
```

- [ ] **Step 5: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(onboarding\)/onboarding/chart-of-accounts/ src/app/\(onboarding\)/onboarding/departments/ src/app/\(onboarding\)/onboarding/team/ src/app/\(onboarding\)/onboarding/template/
git commit -m "feat: add onboarding COA, departments, team, and template pages"
```

---

## Task 9: Onboarding Complete Page & App Layout Redirect

**Files:**
- Create: `src/app/(onboarding)/onboarding/complete/page.tsx`

- [ ] **Step 1: Create completion page**

```tsx
// src/app/(onboarding)/onboarding/complete/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  async function handleComplete() {
    setCompleting(true);
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnboardingComplete: true, onboardingStep: 6 }),
      });
      router.push("/dashboard");
    } catch {
      setCompleting(false);
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">You&apos;re all set!</h1>
      <p className="mb-8 text-sm text-slate-500">
        Your workspace is ready. You can always update these settings later.
      </p>
      <button
        onClick={handleComplete}
        disabled={completing}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {completing ? "Finishing..." : "Go to Dashboard"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(onboarding\)/onboarding/complete/page.tsx
git commit -m "feat: add onboarding complete page"
```

---

## Task 10: Remove Onboarding Modal & Update App Layout

**Files:**
- Delete: `src/components/onboarding-modal.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Update app layout to redirect instead of showing modal**

In `src/app/(app)/layout.tsx`:

1. Remove the import: `import { OnboardingModal } from "@/components/onboarding-modal";`
2. Remove `showOnboarding` state and `handleOnboardingComplete` function
3. Change the profile check to redirect:

```ts
useEffect(() => {
  fetch("/api/auth/profile")
    .then((r) => r.json())
    .then((json) => {
      if (json.success && json.data) {
        setUserEmail(json.data.email || "");
        if (!json.data.isOnboardingComplete) {
          // Resume from the correct onboarding step
          const STEP_ROUTES = [
            "/onboarding",                    // 0: welcome
            "/onboarding/workspace",          // 1: workspace
            "/onboarding/chart-of-accounts",  // 2: COA
            "/onboarding/departments",        // 3: departments
            "/onboarding/team",               // 4: team
            "/onboarding/template",           // 5: template
            "/onboarding/complete",           // 6: complete
          ];
          const step = json.data.onboardingStep || 0;
          router.push(STEP_ROUTES[step] || "/onboarding");
          return;
        }
      }
      setProfileLoaded(true);
    })
    .catch(() => setProfileLoaded(true));
}, [router]);
```

4. Remove the modal JSX at the bottom:
```tsx
// Remove this block:
{profileLoaded && showOnboarding && (
  <OnboardingModal onComplete={handleOnboardingComplete} />
)}
```

- [ ] **Step 2: Delete the old onboarding modal**

Delete `src/components/onboarding-modal.tsx`.

- [ ] **Step 3: Verify no other imports of OnboardingModal**

Run: `grep -r "onboarding-modal\|OnboardingModal" src/ --include="*.ts" --include="*.tsx"`
Expected: No results.

- [ ] **Step 4: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git rm src/components/onboarding-modal.tsx
git commit -m "refactor: remove onboarding modal, redirect to dedicated pages"
```

---

## Task 11: Settings Layout with Sidebar

**Files:**
- Create: `src/app/(app)/settings/layout.tsx`

- [ ] **Step 1: Create settings layout with sidebar navigation**

```tsx
// src/app/(app)/settings/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Shield,
  Trash2,
  Building2,
  Users,
  Mail,
  BookOpen,
  Store,
  UserSquare2,
  Package,
  Layers,
  FileSpreadsheet,
  Lock,
  Landmark,
  ClipboardList,
} from "lucide-react";

const SETTINGS_NAV = [
  {
    label: "ACCOUNT",
    items: [
      { href: "/settings/profile", label: "Profile", icon: User },
      { href: "/settings/security", label: "Security", icon: Shield },
      { href: "/settings/delete-account", label: "Delete Account", icon: Trash2 },
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      { href: "/settings/workspace/general", label: "General", icon: Building2 },
      { href: "/settings/workspace/members", label: "Members & Roles", icon: Users },
      { href: "/settings/workspace/invitations", label: "Invitations", icon: Mail },
      { href: "/settings/workspace/delete", label: "Delete Workspace", icon: Trash2 },
    ],
  },
  {
    label: "MASTER DATA",
    items: [
      { href: "/settings/masterdata/coa", label: "Chart of Accounts", icon: BookOpen },
      { href: "/settings/masterdata/vendors", label: "Vendors", icon: Store },
      { href: "/settings/masterdata/customers", label: "Customers", icon: UserSquare2 },
      { href: "/settings/masterdata/products", label: "Products", icon: Package },
      { href: "/settings/masterdata/departments", label: "Departments", icon: Layers },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { href: "/settings/accounting/templates", label: "Export Templates", icon: FileSpreadsheet },
      { href: "/settings/accounting/period-locks", label: "Period Locks", icon: Lock },
      { href: "/settings/accounting/bank-recon", label: "Bank Reconciliation", icon: Landmark },
      { href: "/settings/accounting/tax-reports", label: "Tax Reports", icon: ClipboardList },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6">
      {/* Settings Sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <nav className="space-y-6">
          {SETTINGS_NAV.map((group) => (
            <div key={group.label}>
              <h3 className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-blue-50 font-medium text-blue-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile settings nav */}
      <div className="mb-4 lg:hidden">
        <select
          value={pathname}
          onChange={(e) => {
            window.location.href = e.target.value;
          }}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        >
          {SETTINGS_NAV.flatMap((group) =>
            group.items.map((item) => (
              <option key={item.href} value={item.href}>
                {group.label} → {item.label}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create redirect from /settings to /settings/profile**

```tsx
// src/app/(app)/settings/page.tsx — replace existing file
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/settings/profile");
}
```

Note: This replaces the existing monolithic `settings/page.tsx`.

- [ ] **Step 3: Verify build passes**

Run: `npx next build`
Expected: Build succeeds (some settings sub-pages won't exist yet — that's ok).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/settings/layout.tsx src/app/\(app\)/settings/page.tsx
git commit -m "feat: add settings layout with sidebar navigation"
```

---

## Task 12: Settings — Profile & Security Pages

**Files:**
- Create: `src/app/(app)/settings/profile/page.tsx`
- Create: `src/app/(app)/settings/security/page.tsx`

- [ ] **Step 1: Create profile settings page**

Extract profile editing from the old `settings/page.tsx`. Shows name (editable), email (read-only).

```tsx
// src/app/(app)/settings/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { User, Save } from "lucide-react";

export default function ProfileSettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setName(json.data.name || "");
          setEmail(json.data.email || "");
        }
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Profile</h1>
      <p className="mb-6 text-sm text-slate-500">Manage your account information.</p>

      <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-400">Email cannot be changed.</p>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create security settings page**

```tsx
// src/app/(app)/settings/security/page.tsx
"use client";

import { useState } from "react";
import { Shield, Eye, EyeOff, Save } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SecuritySettingsPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Password updated successfully" });
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update password" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Security</h1>
      <p className="mb-6 text-sm text-slate-500">Manage your password and security settings.</p>

      <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-slate-900">Change Password</h2>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
          <div className="relative">
            <input
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm New Password</label>
          <input
            type={showPasswords ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {message && (
          <p className={`mb-4 text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}

        <button
          onClick={handleChangePassword}
          disabled={saving || !newPassword || !confirmPassword}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx next build`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/settings/profile/page.tsx src/app/\(app\)/settings/security/page.tsx
git commit -m "feat: add profile and security settings pages"
```

---

## Task 13: Settings — Workspace Pages (General, Members, Invitations)

**Files:**
- Create: `src/app/(app)/settings/workspace/general/page.tsx`
- Create: `src/app/(app)/settings/workspace/members/page.tsx`
- Create: `src/app/(app)/settings/workspace/invitations/page.tsx`

- [ ] **Step 1: Create workspace general settings**

Migrate workspace editing from old settings page. Shows: name, tax ID, VAT registration toggle, base currency, data retention years. Reads tenant ID from `localStorage.getItem("workspaceTenantId")`. Uses `PUT /api/tenants/[id]` to save.

- [ ] **Step 2: Create members management page**

Migrate from `src/app/(app)/settings/tenants/[id]/assignments/page.tsx`. Shows table of current members with name, email, role, joined date, and remove button. Uses `GET /api/tenants/[id]/assignments` and `DELETE /api/tenants/[id]/assignments`.

- [ ] **Step 3: Create invitations management page**

Shows pending and accepted invitations. Uses `GET /api/tenants/[id]/invitations`. Allows resending (create new invitation for same email) and revoking (`DELETE /api/tenants/[id]/invitations`). Add new invitation form (email + role).

- [ ] **Step 4: Verify build passes**

Run: `npx next build`

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/settings/workspace/
git commit -m "feat: add workspace general, members, and invitations settings pages"
```

---

## Task 14: Settings — Migrate Master Data Pages

**Files:**
- Create: `src/app/(app)/settings/masterdata/coa/page.tsx`
- Create: `src/app/(app)/settings/masterdata/vendors/page.tsx`
- Create: `src/app/(app)/settings/masterdata/customers/page.tsx`
- Create: `src/app/(app)/settings/masterdata/products/page.tsx`
- Create: `src/app/(app)/settings/masterdata/departments/page.tsx`

- [ ] **Step 1: Migrate each master data page**

For each page, copy the content from the existing `src/app/(app)/settings/tenants/[id]/*/page.tsx` files. The key change: instead of getting `tenantId` from the URL params (`context.params.id`), read it from `localStorage.getItem("workspaceTenantId")`.

Migrate these files:
- `settings/tenants/[id]/coa/page.tsx` → `settings/masterdata/coa/page.tsx`
- `settings/tenants/[id]/vendors/page.tsx` → `settings/masterdata/vendors/page.tsx`
- `settings/tenants/[id]/customers/page.tsx` → `settings/masterdata/customers/page.tsx`
- `settings/tenants/[id]/products/page.tsx` → `settings/masterdata/products/page.tsx`
- `settings/tenants/[id]/departments/page.tsx` → `settings/masterdata/departments/page.tsx`

Each page should:
1. Read `tenantId` from localStorage on mount
2. Show "No workspace selected" empty state if no tenantId
3. Use the same API calls with the localStorage tenantId
4. Keep the same form/table UX

- [ ] **Step 2: Verify build passes**

Run: `npx next build`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/settings/masterdata/
git commit -m "feat: migrate master data pages to new settings routes"
```

---

## Task 15: Settings — Migrate Accounting Pages

**Files:**
- Create: `src/app/(app)/settings/accounting/templates/page.tsx`
- Create: `src/app/(app)/settings/accounting/period-locks/page.tsx`
- Create: `src/app/(app)/settings/accounting/bank-recon/page.tsx`
- Create: `src/app/(app)/settings/accounting/tax-reports/page.tsx`

- [ ] **Step 1: Migrate each accounting page**

Same pattern as Task 14. Migrate from `settings/tenants/[id]/*/page.tsx`:
- `templates/page.tsx` → `accounting/templates/page.tsx`
- `period-locks/page.tsx` → `accounting/period-locks/page.tsx`
- `bank-recon/page.tsx` → `accounting/bank-recon/page.tsx`
- `tax-reports/page.tsx` → `accounting/tax-reports/page.tsx`

- [ ] **Step 2: Verify build passes**

Run: `npx next build`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/settings/accounting/
git commit -m "feat: migrate accounting pages to new settings routes"
```

---

## Task 16: Delete Old Settings Routes

**Files:**
- Delete: `src/app/(app)/settings/tenants/` (entire directory)

- [ ] **Step 1: Verify no remaining references to old routes**

Run: `grep -r "settings/tenants" src/ --include="*.ts" --include="*.tsx"`

If any references found, update them to point to new routes.

- [ ] **Step 2: Delete old tenant settings directory**

```bash
git rm -r src/app/\(app\)/settings/tenants/
```

- [ ] **Step 3: Verify build passes**

Run: `npx next build`

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: remove old tenant-scoped settings routes"
```

---

## Task 17: Database Migration — Soft Delete Columns

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add deletion columns to schema**

In `src/lib/db/schema.ts`, add to the `tenants` table:

```ts
deletedAt: timestamp("deleted_at", { withTimezone: true }),
deletionScheduledFor: timestamp("deletion_scheduled_for", { withTimezone: true }),
deletionReason: text("deletion_reason"), // "owner_request" | "account_deletion"
```

Add to the `profiles` table:

```ts
deletedAt: timestamp("deleted_at", { withTimezone: true }),
deletionScheduledFor: timestamp("deletion_scheduled_for", { withTimezone: true }),
```

- [ ] **Step 2: Generate and apply migration**

Run: `npx drizzle-kit generate`

Then manually add the partial indexes to the generated migration file:

```sql
CREATE INDEX idx_tenants_deletion_scheduled ON tenants (deletion_scheduled_for) WHERE deletion_scheduled_for IS NOT NULL;
CREATE INDEX idx_profiles_deletion_scheduled ON profiles (deletion_scheduled_for) WHERE deletion_scheduled_for IS NOT NULL;
```

Apply: `npx drizzle-kit push`

- [ ] **Step 3: Verify build passes**

Run: `npx next build`

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts supabase/migrations/
git commit -m "feat: add soft delete columns to tenants and profiles tables"
```

---

## Task 18: Workspace Deletion API

**Files:**
- Modify: `src/app/api/tenants/[id]/route.ts` — add soft delete via PATCH
- Create: `src/app/api/tenants/[id]/cancel-deletion/route.ts`
- Create: `src/app/api/tenants/[id]/transfer-ownership/route.ts`

- [ ] **Step 1: Add soft delete action to tenant PATCH**

In `src/app/api/tenants/[id]/route.ts`, add a PATCH handler (the existing PUT handles updates). The PATCH handler initiates soft delete:

```ts
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;

    // Only workspace owner can initiate deletion
    const [tenant] = await db
      .select({ ownerUserId: tenants.ownerUserId })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }
    if (tenant.ownerUserId !== ctx.userId) {
      return forbidden("Only workspace owner can delete workspace");
    }

    const body = (await request.json()) as { action: "soft_delete" };
    if (body.action !== "soft_delete") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const [updated] = await db
      .update(tenants)
      .set({
        deletedAt: now,
        deletionScheduledFor: scheduledFor,
        deletionReason: "owner_request",
        updatedAt: now,
      })
      .where(eq(tenants.id, id))
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.deletion_initiated",
      entityType: "tenant",
      entityId: id,
      metadata: { scheduledFor: scheduledFor.toISOString() },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create cancel-deletion route**

```ts
// src/app/api/tenants/[id]/cancel-deletion/route.ts
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;

    const [tenant] = await db
      .select({ ownerUserId: tenants.ownerUserId, deletedAt: tenants.deletedAt })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }
    if (tenant.ownerUserId !== ctx.userId) {
      return forbidden("Only workspace owner can cancel deletion");
    }
    if (!tenant.deletedAt) {
      return NextResponse.json({ success: false, error: "Workspace is not pending deletion" }, { status: 400 });
    }

    const [updated] = await db
      .update(tenants)
      .set({
        deletedAt: null,
        deletionScheduledFor: null,
        deletionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.deletion_cancelled",
      entityType: "tenant",
      entityId: id,
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Cancel failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create transfer-ownership route**

```ts
// src/app/api/tenants/[id]/transfer-ownership/route.ts
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, tenantAssignments } from "@/lib/db/schema";
import { forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;

    const [tenant] = await db
      .select({ ownerUserId: tenants.ownerUserId })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }
    if (tenant.ownerUserId !== ctx.userId) {
      return forbidden("Only workspace owner can transfer ownership");
    }

    const body = (await request.json()) as { newOwnerId: string };
    if (!body.newOwnerId) {
      return NextResponse.json({ success: false, error: "newOwnerId is required" }, { status: 400 });
    }

    // Verify new owner is a member of this workspace
    const assignments = await db
      .select()
      .from(tenantAssignments)
      .where(eq(tenantAssignments.tenantId, id));

    const isMember = assignments.some((a) => a.userId === body.newOwnerId);
    if (!isMember) {
      return NextResponse.json({ success: false, error: "New owner must be a workspace member" }, { status: 400 });
    }

    const [updated] = await db
      .update(tenants)
      .set({ ownerUserId: body.newOwnerId, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    await writeAuditLog({
      tenantId: id,
      userId: ctx.userId,
      action: "tenant.ownership_transferred",
      entityType: "tenant",
      entityId: id,
      metadata: { previousOwner: ctx.userId, newOwner: body.newOwnerId },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Transfer failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tenants/\[id\]/route.ts src/app/api/tenants/\[id\]/cancel-deletion/ src/app/api/tenants/\[id\]/transfer-ownership/
git commit -m "feat: add workspace soft delete, cancel deletion, and transfer ownership APIs"
```

---

## Task 19: Workspace Deletion UI

**Files:**
- Create: `src/app/(app)/settings/workspace/delete/page.tsx`

- [ ] **Step 1: Create workspace deletion page**

Page shows: workspace name, member count, data summary. If workspace has other members, requires ownership transfer before deletion. Confirmation modal requires typing workspace name.

Key features:
- Fetch workspace details from `GET /api/tenants/[id]`
- Fetch members from `GET /api/tenants/[id]/assignments`
- If sole member: show delete confirmation directly
- If multiple members: show transfer ownership dropdown + delete
- Already pending deletion: show cancellation option with scheduled date
- Initiate deletion via `PATCH /api/tenants/[id]` with `{ action: "soft_delete" }`
- Cancel via `POST /api/tenants/[id]/cancel-deletion`

- [ ] **Step 2: Verify build passes**

Run: `npx next build`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/settings/workspace/delete/page.tsx
git commit -m "feat: add workspace deletion settings page"
```

---

## Task 20: Account Deletion API

**Files:**
- Create: `src/app/api/auth/account/route.ts`
- Create: `src/app/api/auth/account/cancel-deletion/route.ts`

- [ ] **Step 1: Create account deletion endpoint**

```ts
// src/app/api/auth/account/route.ts
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles, tenants } from "@/lib/db/schema";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function DELETE(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const body = (await request.json()) as {
      workspaceActions: Array<{
        tenantId: string;
        action: "transfer" | "delete";
        newOwnerId?: string;
      }>;
    };

    // Process workspace actions
    for (const wa of body.workspaceActions) {
      if (wa.action === "transfer" && wa.newOwnerId) {
        await db
          .update(tenants)
          .set({ ownerUserId: wa.newOwnerId, updatedAt: new Date() })
          .where(eq(tenants.id, wa.tenantId));
      } else if (wa.action === "delete") {
        const now = new Date();
        const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await db
          .update(tenants)
          .set({
            deletedAt: now,
            deletionScheduledFor: scheduledFor,
            deletionReason: "account_deletion",
            updatedAt: now,
          })
          .where(eq(tenants.id, wa.tenantId));
      }
    }

    // Soft delete the account
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db
      .update(profiles)
      .set({
        deletedAt: now,
        deletionScheduledFor: scheduledFor,
        updatedAt: now,
      })
      .where(eq(profiles.id, ctx.userId));

    return NextResponse.json({
      success: true,
      data: { deletionScheduledFor: scheduledFor.toISOString() },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create cancel account deletion endpoint**

```ts
// src/app/api/auth/account/cancel-deletion/route.ts
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles, tenants } from "@/lib/db/schema";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const [profile] = await db
      .select({ deletedAt: profiles.deletedAt })
      .from(profiles)
      .where(eq(profiles.id, ctx.userId))
      .limit(1);

    if (!profile?.deletedAt) {
      return NextResponse.json({ success: false, error: "Account is not pending deletion" }, { status: 400 });
    }

    // Cancel account deletion
    await db
      .update(profiles)
      .set({ deletedAt: null, deletionScheduledFor: null, updatedAt: new Date() })
      .where(eq(profiles.id, ctx.userId));

    // Cancel workspace deletions that were triggered by account deletion
    await db
      .update(tenants)
      .set({ deletedAt: null, deletionScheduledFor: null, deletionReason: null, updatedAt: new Date() })
      .where(
        and(
          eq(tenants.ownerUserId, ctx.userId),
          eq(tenants.deletionReason, "account_deletion")
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Cancel failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx next build`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/account/
git commit -m "feat: add account deletion and cancel deletion APIs"
```

---

## Task 21: Account Deletion UI & Deletion Pending Page

**Files:**
- Create: `src/app/(app)/settings/delete-account/page.tsx`
- Create: `src/app/(auth)/account-deleted/page.tsx`

- [ ] **Step 1: Create account deletion settings page**

Page shows: account info, lists owned workspaces. For each workspace with other members, user chooses transfer or delete. For sole-member workspaces, auto-marks for deletion. Confirmation modal requires typing email.

Key features:
- Fetch owned workspaces: `GET /api/tenants` then filter by `ownerUserId`
- For each workspace, show member count from `GET /api/tenants/[id]/assignments`
- Transfer ownership dropdown: list of workspace members
- Delete account: `DELETE /api/auth/account` with workspace actions
- After deletion: logout and redirect to `/login`

- [ ] **Step 2: Create account-deleted page**

Shows when a user with pending account deletion logs in. Displays the scheduled deletion date and "Cancel deletion" button.

```tsx
// src/app/(auth)/account-deleted/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export default function AccountDeletedPage() {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/auth/account/cancel-deletion", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        router.push("/dashboard");
      }
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
        <AlertTriangle className="h-6 w-6 text-amber-600" />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Account Scheduled for Deletion</h1>
      <p className="mb-6 text-sm text-slate-500">
        Your account is scheduled to be permanently deleted. You can cancel this action to keep your account.
      </p>
      <button
        onClick={handleCancel}
        disabled={cancelling}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {cancelling ? "Cancelling..." : "Cancel Deletion & Keep Account"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx next build`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/settings/delete-account/page.tsx src/app/\(auth\)/account-deleted/page.tsx
git commit -m "feat: add account deletion UI and deletion-pending page"
```

---

## Task 22: Middleware — Deletion Checks

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Add account deletion check to middleware**

After the email verification check in middleware, add account deletion check. Since middleware can't easily query the DB for `profiles.deletedAt`, we handle this in the app layout instead (similar to the onboarding redirect approach).

In `src/app/(app)/layout.tsx`, add to the profile check:

```ts
// In the useEffect that fetches profile:
if (json.data.deletedAt) {
  router.push("/account-deleted");
  return;
}
```

- [ ] **Step 2: Add workspace deletion banner to app layout**

Add a banner component that shows when the current workspace is pending deletion:

```tsx
// In app layout, after fetching tenant details:
// If tenant.deletedAt is set, show a warning banner at the top
```

The workspace selector should also indicate deletion status. When switching workspaces, check if the selected workspace has `deletedAt` set and show the banner.

- [ ] **Step 3: Verify build passes**

Run: `npx next build`

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/middleware.ts src/app/\(app\)/layout.tsx
git commit -m "feat: add deletion checks in app layout for account and workspace"
```

---

## Task 23: Inngest Purge Functions

**Files:**
- Create: `src/lib/inngest/functions/workspace-purge.ts`
- Create: `src/lib/inngest/functions/account-purge.ts`

- [ ] **Step 1: Create workspace purge function**

```ts
// src/lib/inngest/functions/workspace-purge.ts
import { inngest } from "../client";
import { db } from "@/lib/db";
import { tenants, tenantAssignments } from "@/lib/db/schema";
import { lte, isNotNull, and } from "drizzle-orm";
import { eq } from "drizzle-orm";

export const workspacePurge = inngest.createFunction(
  { id: "workspace-purge", name: "Purge Expired Workspaces" },
  { cron: "0 3 * * *" }, // Daily at 3 AM
  async ({ step }) => {
    const expiredTenants = await step.run("find-expired-workspaces", async () => {
      return db
        .select({ id: tenants.id, name: tenants.name, ownerUserId: tenants.ownerUserId })
        .from(tenants)
        .where(
          and(
            isNotNull(tenants.deletionScheduledFor),
            lte(tenants.deletionScheduledFor, new Date())
          )
        );
    });

    for (const tenant of expiredTenants) {
      await step.run(`purge-workspace-${tenant.id}`, async () => {
        // Cascade delete handles related data (documents, COA, etc.)
        await db.delete(tenantAssignments).where(eq(tenantAssignments.tenantId, tenant.id));
        await db.delete(tenants).where(eq(tenants.id, tenant.id));
        return { purgedTenantId: tenant.id, name: tenant.name };
      });
    }

    return { purgedCount: expiredTenants.length };
  }
);
```

- [ ] **Step 2: Create account purge function**

```ts
// src/lib/inngest/functions/account-purge.ts
import { inngest } from "../client";
import { db } from "@/lib/db";
import { profiles, tenants, tenantAssignments } from "@/lib/db/schema";
import { lte, isNotNull, and, eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

export const accountPurge = inngest.createFunction(
  { id: "account-purge", name: "Purge Expired Accounts" },
  { cron: "0 4 * * *" }, // Daily at 4 AM (after workspace purge)
  async ({ step }) => {
    const expiredProfiles = await step.run("find-expired-accounts", async () => {
      return db
        .select({ id: profiles.id, email: profiles.email })
        .from(profiles)
        .where(
          and(
            isNotNull(profiles.deletionScheduledFor),
            lte(profiles.deletionScheduledFor, new Date())
          )
        );
    });

    for (const profile of expiredProfiles) {
      await step.run(`purge-account-${profile.id}`, async () => {
        // Delete solely-owned workspaces
        const ownedTenants = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.ownerUserId, profile.id));

        for (const tenant of ownedTenants) {
          await db.delete(tenantAssignments).where(eq(tenantAssignments.tenantId, tenant.id));
          await db.delete(tenants).where(eq(tenants.id, tenant.id));
        }

        // Remove all tenant assignments
        await db.delete(tenantAssignments).where(eq(tenantAssignments.userId, profile.id));

        // Delete profile
        await db.delete(profiles).where(eq(profiles.id, profile.id));

        // Delete Supabase auth user
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await supabaseAdmin.auth.admin.deleteUser(profile.id);

        return { purgedUserId: profile.id, email: profile.email };
      });
    }

    return { purgedCount: expiredProfiles.length };
  }
);
```

- [ ] **Step 3: Register functions with Inngest**

In `src/app/api/inngest/route.ts`, add the imports and register the new functions:

```ts
import { workspacePurge } from "@/lib/inngest/functions/workspace-purge";
import { accountPurge } from "@/lib/inngest/functions/account-purge";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processDocument,
    sendWeeklyDigest,
    notifyDocumentRejected,
    notifyDocumentPendingApproval,
    applyDataRetention,
    autoExpirePendingApprovals,
    workspacePurge,    // <-- add
    accountPurge,      // <-- add
  ],
});
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/inngest/functions/workspace-purge.ts src/lib/inngest/functions/account-purge.ts
git commit -m "feat: add Inngest purge functions for workspace and account deletion"
```

---

## Task 24: Final Cleanup & Verification

- [ ] **Step 1: Search for remaining references to old routes/components**

```bash
grep -r "onboarding-modal\|OnboardingModal" src/ --include="*.ts" --include="*.tsx"
grep -r "settings/tenants/\[id\]" src/ --include="*.ts" --include="*.tsx"
```

Fix any remaining references.

- [ ] **Step 2: Verify the complete middleware priority chain**

Read `src/lib/supabase/middleware.ts` and verify the checks are in order:
1. Unauthenticated → /login
2. Email unverified → /signup/verify-email
3. Authenticated on auth pages → /dashboard

App layout handles:
4. Account deleted → /account-deleted
5. Onboarding incomplete → /onboarding

- [ ] **Step 3: Full build verification**

Run: `npx next build`
Expected: Clean build, no errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for auth, onboarding, settings rework"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | App URL utility | `src/lib/utils/app-url.ts` |
| 2 | Auth callback route | `src/app/auth/callback/route.ts` |
| 3 | Verify email page | `src/app/(auth)/signup/verify-email/page.tsx` |
| 4 | Middleware email check | `src/lib/supabase/middleware.ts` |
| 5 | DB migration: onboarding step | `src/lib/db/schema.ts` |
| 6 | Onboarding layout | `src/app/(onboarding)/layout.tsx` |
| 7 | Onboarding: welcome + workspace | 2 page files |
| 8 | Onboarding: COA, depts, team, template | 4 page files |
| 9 | Onboarding: complete + redirect | `complete/page.tsx`, middleware |
| 10 | Remove onboarding modal | Delete `onboarding-modal.tsx` |
| 11 | Settings layout + sidebar | `settings/layout.tsx` |
| 12 | Settings: profile + security | 2 page files |
| 13 | Settings: workspace pages | 3 page files |
| 14 | Settings: master data migration | 5 page files |
| 15 | Settings: accounting migration | 4 page files |
| 16 | Delete old settings routes | Remove `settings/tenants/` |
| 17 | DB migration: soft delete | Schema + migration |
| 18 | Workspace deletion API | 3 API routes |
| 19 | Workspace deletion UI | 1 page file |
| 20 | Account deletion API | 2 API routes |
| 21 | Account deletion UI | 2 page files |
| 22 | Middleware deletion checks | Middleware + layout |
| 23 | Inngest purge functions | 2 function files |
| 24 | Final cleanup | Verification |
