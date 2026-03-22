"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { WorkspaceSelector } from "@/components/workspace-selector";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const nav = [
  {
    href: "/upload",
    label: "Upload Documents",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    href: "/documents",
    label: "Preview",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/extractions",
    label: "Extractions",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    href: "/query-tray",
    label: "Query tray",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
        />
      </svg>
    ),
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/export",
    label: "Export to Express",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceDeleted, setWorkspaceDeleted] = useState<{ name: string; scheduledFor: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setUserEmail(json.data.email || "");
          if (json.data.deletedAt) {
            router.push("/account-deleted");
            return;
          }
          if (!json.data.isOnboardingComplete) {
            const STEP_ROUTES = [
              "/onboarding",
              "/onboarding/workspace",
              "/onboarding/chart-of-accounts",
              "/onboarding/departments",
              "/onboarding/team",
              "/onboarding/template",
              "/onboarding/complete",
            ];
            const step = json.data.onboardingStep || 0;
            router.push(STEP_ROUTES[step] || "/onboarding");
            return;
          }
        }
        // profile loaded
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const tenantId = localStorage.getItem("workspaceTenantId");
    if (!tenantId || tenantId === "00000000-0000-0000-0000-000000000000") return;

    fetch(`/api/tenants/${tenantId}`, {
      headers: { "x-tenant-id": tenantId },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.deletedAt) {
          setWorkspaceDeleted({
            name: json.data.name,
            scheduledFor: json.data.deletionScheduledFor,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // proceed to redirect even if sign-out request fails
    }
    router.push("/login");
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 md:grid md:grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <aside className="hidden border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-800">AiCount</span>
        </div>

        {userEmail && (
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="truncate text-xs text-slate-500">{userEmail}</p>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-blue-50 font-medium text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-0.5 border-t border-slate-200 px-2 py-3">
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-blue-50 font-medium text-blue-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="rounded p-1 md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h1 className="text-sm font-medium text-slate-500 md:hidden">AiCount</h1>
          </div>
          <div className="flex items-center gap-3">
            <WorkspaceSelector />
          </div>
        </header>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="border-b bg-white px-4 py-2 md:hidden">
            <div className="flex flex-wrap gap-1.5">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/settings" onClick={() => setMobileMenuOpen(false)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                Settings
              </Link>
            </div>
          </nav>
        )}

        {workspaceDeleted && (
          <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2">
            <p className="text-sm text-amber-800">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              Workspace &quot;{workspaceDeleted.name}&quot; is scheduled for deletion on{" "}
              {new Date(workspaceDeleted.scheduledFor).toLocaleDateString()}.
            </p>
            <Link href="/settings/workspace/delete" className="text-sm text-amber-700 hover:text-amber-900 font-medium">
              Manage →
            </Link>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
