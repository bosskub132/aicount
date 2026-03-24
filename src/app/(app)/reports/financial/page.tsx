import Link from "next/link";
import {
  Tag,
  BarChart3,
  Briefcase,
  DollarSign,
  Table2,
  FileText,
  PenLine,
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

const financialStatements: ReportCard[] = [
  {
    title: "Trial Balance",
    subtitle: "งบทดลอง",
    href: "/reports/financial/trial-balance",
    icon: Tag,
    iconColor: "#2563eb",
    iconBg: "#eff6ff",
  },
  {
    title: "Profit & Loss",
    subtitle: "งบกำไรขาดทุน",
    href: "/reports/financial/profit-loss",
    icon: BarChart3,
    iconColor: "#059669",
    iconBg: "#f0fdf4",
  },
  {
    title: "Balance Sheet",
    subtitle: "งบแสดงฐานะการเงิน",
    href: "/reports/financial/balance-sheet",
    icon: Briefcase,
    iconColor: "#d97706",
    iconBg: "#fef3c7",
  },
  {
    title: "Cash Flow",
    subtitle: "งบกระแสเงินสด",
    href: "/reports/financial/cash-flow",
    icon: DollarSign,
    iconColor: "#e11d48",
    iconBg: "#fce4ec",
  },
];

const accountingReports: ReportCard[] = [
  {
    title: "Monthly Comparison",
    subtitle: "เปรียบเทียบรายเดือน",
    href: "/reports/financial/monthly-comparison",
    icon: Table2,
    iconColor: "#7c3aed",
    iconBg: "#f5f3ff",
  },
  {
    title: "GL Detail",
    subtitle: "รายละเอียดบัญชีแยกประเภท",
    href: "/reports/financial/gl-detail",
    icon: FileText,
    iconColor: "#059669",
    iconBg: "#ecfdf5",
  },
  {
    title: "Journal Listing",
    subtitle: "รายการสมุดรายวัน",
    href: "/reports/financial/journal-listing",
    icon: PenLine,
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

export default function FinancialReportsPage() {
  return (
    <section className="space-y-5 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Financial Statements
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          รายงานทางการเงิน
        </p>
      </div>

      {/* Section 1: Financial Statements */}
      <div>
        <div className="mb-3.5">
          <div className="text-base font-bold text-[var(--foreground)]">
            Financial Statements
          </div>
          <div className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
            งบการเงิน
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {financialStatements.map((card) => (
            <ReportCardItem key={card.href} card={card} />
          ))}
        </div>
      </div>

      {/* Section 2: Accounting Reports */}
      <div>
        <div className="mb-3.5">
          <div className="text-base font-bold text-[var(--foreground)]">
            Accounting Reports
          </div>
          <div className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
            รายงานบัญชี
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accountingReports.map((card) => (
            <ReportCardItem key={card.href} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
