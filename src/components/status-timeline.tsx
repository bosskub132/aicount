// src/components/status-timeline.tsx
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface TimelineEntry {
  status: string;
  timestamp: string;
  label?: string;
}

interface StatusTimelineProps {
  entries: TimelineEntry[];
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  APPROVED: CheckCircle2,
  EXPORTED: CheckCircle2,
  REJECTED: AlertTriangle,
};

export function StatusTimeline({ entries }: StatusTimelineProps) {
  return (
    <div className="flex flex-col gap-0">
      {entries.map((entry, i) => {
        const Icon = statusIcons[entry.status] || Clock;
        const isLast = i === entries.length - 1;
        return (
          <div key={`${entry.status}-${entry.timestamp}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Icon className={`h-4 w-4 ${isLast ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
              {!isLast && <div className="w-px flex-1 bg-[var(--border)]" />}
            </div>
            <div className="pb-3">
              <p className={`text-xs font-medium ${isLast ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
                {entry.label || entry.status.replace(/_/g, " ")}
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {new Date(entry.timestamp).toLocaleString("th-TH")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
