// src/components/report-stat-cards.tsx
import { Skeleton } from "@/components/skeleton";

interface StatCardItem {
  label: string;
  value: string | number;
  color: string; // CSS for left border, e.g. "border-l-[var(--success)]"
  format?: "currency" | "percentage" | "number";
}

interface ReportStatCardsProps {
  items: StatCardItem[];
  isLoading?: boolean;
}

function formatValue(value: string | number, format?: "currency" | "percentage" | "number"): string {
  if (typeof value === "string") return value;

  switch (format) {
    case "currency":
      return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "percentage":
      return `${value.toFixed(2)}%`;
    case "number":
      return value.toLocaleString("th-TH");
    default:
      return String(value);
  }
}

export function ReportStatCards({ items, isLoading }: ReportStatCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-card)] border border-[var(--border)] border-l-4 border-l-[var(--muted)] bg-white p-5"
          >
            <Skeleton variant="text" width="60%" height="14px" />
            <Skeleton variant="text" width="80%" height="28px" className="mt-2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-[var(--radius-card)] border border-[var(--border)] border-l-4 ${item.color} bg-white p-5`}
        >
          <p className="text-xs text-[var(--muted-foreground)]">{item.label}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">
            {formatValue(item.value, item.format)}
          </p>
        </div>
      ))}
    </div>
  );
}
