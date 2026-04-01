"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BarChart3, Wrench, Users, LogOut } from "lucide-react";

const navGroups = [
  {
    label: "ANALYTICS",
    items: [
      { href: "/backoffice/overview", label: "AI Overview", icon: LayoutGrid, disabled: false },
      { href: "/backoffice/cost-analysis", label: "Cost Analysis", icon: BarChart3, disabled: true },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { href: "/backoffice/rules", label: "Extraction Rules", icon: Wrench, disabled: false },
      { href: "/backoffice/tenants", label: "Tenants", icon: Users, disabled: false },
    ],
  },
];

export function BackofficeSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-[var(--border)] bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-white text-xs font-bold">
          AI
        </div>
        <span className="text-[15px] font-semibold text-[var(--foreground)]">AICount</span>
        <span className="rounded-full bg-[var(--destructive)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
          BACKOFFICE
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive =
                !item.disabled &&
                (pathname === item.href || pathname?.startsWith(item.href + "/"));
              const Icon = item.icon;
              const itemClass = `flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 ${
                item.disabled
                  ? "opacity-50 cursor-default text-[var(--secondary)]"
                  : isActive
                  ? "bg-[var(--primary-light)] text-[var(--primary)]"
                  : "text-[var(--secondary)] hover:bg-[var(--muted)]"
              }`;

              if (item.disabled) {
                return (
                  <span key={item.href} className={itemClass}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={itemClass}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[12px] font-medium transition-colors duration-100 text-[var(--secondary)] hover:bg-[var(--muted)]"
        >
          <LogOut className="h-4 w-4" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}
