// src/components/stat-card.tsx
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function StatCard({ title, value, trend, trendValue }: StatCardProps) {
  const trendColor = trend === "up" ? "text-[var(--success)]" : trend === "down" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
      <p className="text-xs text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
      {trendValue && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trendValue}
        </p>
      )}
    </div>
  );
}
