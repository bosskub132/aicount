import Link from "next/link";
import {
  Receipt,
  Globe,
  User,
  Building2,
  ShoppingCart,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ReportCard {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

const taxFilingReports: ReportCard[] = [
  {
    title: "\u0e20.\u0e1e.30 VAT Return",
    subtitle: "\u0e41\u0e1a\u0e1a\u0e22\u0e37\u0e48\u0e19\u0e20\u0e32\u0e29\u0e35\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21",
    href: "/reports/tax/pp30",
    icon: Receipt,
    iconColor: "#2563eb",
    iconBg: "#eff6ff",
  },
  {
    title: "\u0e20.\u0e1e.36 Non-Resident",
    subtitle: "\u0e20\u0e32\u0e29\u0e35\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e1c\u0e39\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e16\u0e34\u0e48\u0e19\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48",
    href: "/reports/tax/pp36",
    icon: Globe,
    iconColor: "#7c3aed",
    iconBg: "#f5f3ff",
  },
  {
    title: "\u0e20.\u0e07.\u0e14.3 Individual WHT",
    subtitle: "\u0e2b\u0e31\u0e01 \u0e13 \u0e17\u0e35\u0e48\u0e08\u0e48\u0e32\u0e22\u0e1a\u0e38\u0e04\u0e04\u0e25\u0e18\u0e23\u0e23\u0e21\u0e14\u0e32",
    href: "/reports/tax/pnd3",
    icon: User,
    iconColor: "#059669",
    iconBg: "#f0fdf4",
  },
  {
    title: "\u0e20.\u0e07.\u0e14.53 Corporate WHT",
    subtitle: "\u0e2b\u0e31\u0e01 \u0e13 \u0e17\u0e35\u0e48\u0e08\u0e48\u0e32\u0e22\u0e19\u0e34\u0e15\u0e34\u0e1a\u0e38\u0e04\u0e04\u0e25",
    href: "/reports/tax/pnd53",
    icon: Building2,
    iconColor: "#d97706",
    iconBg: "#fef3c7",
  },
];

const vatRegisterReports: ReportCard[] = [
  {
    title: "Purchase VAT Register",
    subtitle: "\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e20\u0e32\u0e29\u0e35\u0e0b\u0e37\u0e49\u0e2d",
    href: "/reports/tax/purchase-vat",
    icon: ShoppingCart,
    iconColor: "#e11d48",
    iconBg: "#fce4ec",
  },
  {
    title: "Sales VAT Register",
    subtitle: "\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e20\u0e32\u0e29\u0e35\u0e02\u0e32\u0e22",
    href: "/reports/tax/sales-vat",
    icon: Store,
    iconColor: "#ea580c",
    iconBg: "#fff7ed",
  },
];

function ReportCardItem({ card }: { card: ReportCard }) {
  const IconComponent = card.icon;
  return (
    <Link
      href={card.href}
      className="flex flex-col items-start rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 transition hover:shadow-sm"
    >
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: card.iconBg }}
      >
        <IconComponent
          className="h-[18px] w-[18px]"
          style={{ color: card.iconColor }}
        />
      </div>
      <div className="text-sm font-semibold text-[var(--foreground)]">
        {card.title}
      </div>
      <div className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
        {card.subtitle}
      </div>
    </Link>
  );
}

export default function TaxReportsPage() {
  return (
    <section className="space-y-5 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Tax Reports
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {"\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e20\u0e32\u0e29\u0e35"}
        </p>
      </div>

      {/* Section 1: Tax Filing */}
      <div>
        <div className="mb-3.5">
          <div className="text-base font-bold text-[var(--foreground)]">
            Tax Filing
          </div>
          <div className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
            {"\u0e41\u0e1a\u0e1a\u0e22\u0e37\u0e48\u0e19\u0e20\u0e32\u0e29\u0e35"}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {taxFilingReports.map((card) => (
            <ReportCardItem key={card.href} card={card} />
          ))}
        </div>
      </div>

      {/* Section 2: VAT Registers */}
      <div>
        <div className="mb-3.5">
          <div className="text-base font-bold text-[var(--foreground)]">
            VAT Registers
          </div>
          <div className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
            {"\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e20\u0e32\u0e29\u0e35\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21"}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {vatRegisterReports.map((card) => (
            <ReportCardItem key={card.href} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
