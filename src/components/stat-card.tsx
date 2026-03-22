// src/components/stat-card.tsx
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  href?: string;
}

export function StatCard({ title, value, trend, trendValue, href }: StatCardProps) {
  const trendColor = trend === "up" ? "text-[var(--success)]" : trend === "down" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const content = (
    <>
      <p className="text-xs text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
      {trendValue && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trendValue}
        </p>
      )}
    </>
  );

  const baseClass = "rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5";
  const hoverClass = href ? " hover:border-[var(--primary)] hover:shadow-[var(--shadow-sm)] transition-all cursor-pointer" : "";

  if (href) {
    return (
      <Link href={href} className={`block ${baseClass}${hoverClass}`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={baseClass}>
      {content}
    </div>
  );
}
