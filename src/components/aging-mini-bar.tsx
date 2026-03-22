interface AgingBuckets {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  overdue: number;
}

interface AgingMiniBarProps {
  buckets: AgingBuckets;
  className?: string;
}

const SEGMENTS: { key: keyof AgingBuckets; color: string }[] = [
  { key: "current", color: "var(--aging-current)" },
  { key: "d30", color: "var(--aging-30)" },
  { key: "d60", color: "var(--aging-60)" },
  { key: "d90", color: "var(--aging-90)" },
  { key: "overdue", color: "var(--aging-overdue)" },
];

export function AgingMiniBar({ buckets, className = "" }: AgingMiniBarProps) {
  const total =
    buckets.current + buckets.d30 + buckets.d60 + buckets.d90 + buckets.overdue;

  return (
    <div
      className={`flex h-1 w-full overflow-hidden rounded-sm ${className}`}
      role="img"
      aria-label={`Aging: current ${buckets.current}, 30d ${buckets.d30}, 60d ${buckets.d60}, 90d ${buckets.d90}, overdue ${buckets.overdue}`}
    >
      {total === 0 ? (
        <div className="w-full bg-[var(--muted)]" />
      ) : (
        SEGMENTS.map(({ key, color }) => {
          const pct = (buckets[key] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              style={{
                width: `${pct}%`,
                backgroundColor: color,
              }}
            />
          );
        })
      )}
    </div>
  );
}
