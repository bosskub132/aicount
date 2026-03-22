"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    group: "ACCOUNT",
    items: [
      { label: "Profile", href: "/settings/profile", icon: User },
      { label: "Security", href: "/settings/security", icon: Shield },
      { label: "Delete Account", href: "/settings/delete-account", icon: Trash2 },
    ],
  },
  {
    group: "WORKSPACE",
    items: [
      { label: "General", href: "/settings/workspace/general", icon: Building2 },
      { label: "Members & Roles", href: "/settings/workspace/members", icon: Users },
      { label: "Invitations", href: "/settings/workspace/invitations", icon: Mail },
      { label: "Delete Workspace", href: "/settings/workspace/delete", icon: Trash2 },
    ],
  },
  {
    group: "MASTER DATA",
    items: [
      { label: "Chart of Accounts", href: "/settings/masterdata/coa", icon: BookOpen },
      { label: "Vendors", href: "/settings/masterdata/vendors", icon: Store },
      { label: "Customers", href: "/settings/masterdata/customers", icon: UserSquare2 },
      { label: "Products", href: "/settings/masterdata/products", icon: Package },
      { label: "Departments", href: "/settings/masterdata/departments", icon: Layers },
    ],
  },
  {
    group: "ACCOUNTING",
    items: [
      { label: "Export Templates", href: "/settings/accounting/templates", icon: FileSpreadsheet },
      { label: "Period Locks", href: "/settings/accounting/period-locks", icon: Lock },
      { label: "Bank Reconciliation", href: "/settings/accounting/bank-recon", icon: Landmark },
      { label: "Tax Reports", href: "/settings/accounting/tax-reports", icon: ClipboardList },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(e.target.value);
  }

  const currentHref =
    allItems.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.href ?? "";

  return (
    <div className="flex gap-6">
      {/* Sidebar — hidden on mobile, visible on lg+ */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <nav className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.group}>
              <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          isActive
                            ? "bg-blue-50 font-medium text-blue-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
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

      {/* Mobile dropdown */}
      <div className="mb-4 lg:hidden">
        <select
          value={currentHref}
          onChange={handleSelectChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {navGroups.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.items.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Main content */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
