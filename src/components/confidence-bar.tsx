// src/components/confidence-bar.tsx
interface ConfidenceBarProps {
  score: number; // 0-1 or 0-100
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ConfidenceBar({ score, size = "md", showLabel = true }: ConfidenceBarProps) {
  const normalized = score > 1 ? score / 100 : score;
  const percent = Math.round(normalized * 100);
  const color =
    normalized >= 0.8
      ? "bg-[var(--success)]"
      : normalized >= 0.5
        ? "bg-[var(--warning)]"
        : "bg-[var(--destructive)]";
  const textColor =
    normalized >= 0.8
      ? "text-[var(--success)]"
      : normalized >= 0.5
        ? "text-[var(--warning)]"
        : "text-[var(--destructive)]";
  const h = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} rounded-full bg-[var(--muted)] overflow-hidden`}>
        <div className={`${h} rounded-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      {showLabel && <span className={`text-xs font-medium tabular-nums ${textColor}`}>{percent}%</span>}
    </div>
  );
}
