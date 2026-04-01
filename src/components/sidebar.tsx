"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  FileText,
  CheckCircle2,
  BookOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  FileCheck,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { WorkspaceSelector } from "@/components/workspace-selector";

const navGroups = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "DOCUMENTS",
    items: [
      { href: "/upload", label: "Upload & OCR", icon: Upload },
      { href: "/documents", label: "All Documents", icon: FileText },
      { href: "/documents?tab=pending", label: "Approvals", icon: CheckCircle2 },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { href: "/ledger", label: "General Ledger", icon: BookOpen },
      { href: "/receivables", label: "Accounts Receivable", icon: ArrowDownToLine },
      { href: "/payables", label: "Accounts Payable", icon: ArrowUpFromLine },
      { href: "/bank-recon", label: "Bank Recon", icon: ArrowLeftRight },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { href: "/reports/financial", label: "Financial Statements", icon: BarChart3 },
      { href: "/reports/tax", label: "Tax Reports", icon: ClipboardList },
      { href: "/reports/wht", label: "WHT Certificates", icon: FileCheck },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-white text-xs font-bold">
          AI
        </div>
        <span className="text-[15px] font-semibold text-[var(--foreground)]">AICount</span>

        {/* Close button for mobile */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="ml-auto p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] md:hidden cursor-pointer"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Workspace Selector */}
      <div className="border-b border-[var(--border)] px-4 py-2.5">
        <WorkspaceSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 ${
                    isActive
                      ? "bg-[var(--primary-light)] text-[var(--primary)]"
                      : "text-[var(--secondary)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: Settings + Backoffice */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 ${
            pathname?.startsWith("/settings")
              ? "bg-[var(--primary-light)] text-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <Link
          href="/backoffice"
          className={`flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 ${
            pathname?.startsWith("/backoffice")
              ? "bg-[var(--primary-light)] text-[var(--primary)]"
              : "text-[var(--secondary)] hover:bg-[var(--muted)]"
          }`}
        >
          <Shield className="h-4 w-4" />
          Backoffice
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[230px] md:flex-col md:shrink-0 h-screen sticky top-0 border-r border-[var(--border)] bg-white">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] flex flex-col bg-white shadow-[var(--shadow-lg)]">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
