"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { ToastProvider } from "@/components/toast";
import { GlobalSearch } from "@/components/global-search";
import { OfflineBanner } from "@/components/offline-banner";

import { AppQueryProvider } from "@/lib/providers/query-provider";

// Map pathnames to page titles
const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/upload": "Upload & OCR",
  "/documents": "All Documents",
  "/approvals": "Approvals",
  "/extractions": "Extractions",
  "/query-tray": "Query Tray",
  "/export": "Export",
  "/reversal": "Reversals",
  "/ledger": "General Ledger",
  "/receivables": "Accounts Receivable",
  "/payables": "Accounts Payable",
  "/bank-recon": "Bank Reconciliation",
  "/reports/financial": "Financial Statements",
  "/reports/tax": "Tax Reports",
  "/reports/wht": "WHT Certificates",
  "/settings": "Settings",
};

function getPageTitle(pathname: string | null): string {
  if (!pathname) return "AICount";
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.keys(pageTitles)
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname.startsWith(key));
  return match ? pageTitles[match] : "AICount";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);
  const [userName, setUserName] = useState("User");
  const [workspaceDeleted, setWorkspaceDeleted] = useState<{ name: string; scheduledFor: string } | null>(null);

  // Preserve: account deletion redirect + onboarding redirect
  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setUserName(json.data.fullName || json.data.email || "User");
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
      })
      .catch(() => {});
  }, [router]);

  // Preserve: workspace deletion banner
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

  return (
    <AppQueryProvider>
      <div className="flex h-screen bg-[var(--background)]">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <Header title={title} userName={userName} />

          {/* Workspace deletion banner — preserved from v1.1.0 */}
          {workspaceDeleted && (
            <div className="flex items-center justify-between bg-[var(--warning-light)] border-b border-amber-200 px-4 py-2">
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

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
        <GlobalSearch />
        <OfflineBanner />
        <ToastProvider />
      </div>
    </AppQueryProvider>
  );
}
