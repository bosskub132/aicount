"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const TIER_COLORS = ["#059669", "#2563EB", "#F59E0B"]; // success, primary, warning
const TIER_LABELS = ["Tier 1 (Fast)", "Tier 2 (Standard)", "Tier 3 (Batch)"];

interface TierDistributionChartProps {
  tier1: number;
  tier2: number;
  tier3: number;
  totalDocs: number;
}

export function TierDistributionChart({ tier1, tier2, tier3, totalDocs }: TierDistributionChartProps) {
  const total = tier1 + tier2 + tier3;
  const data = [
    { name: TIER_LABELS[0], value: tier1 },
    { name: TIER_LABELS[1], value: tier2 },
    { name: TIER_LABELS[2], value: tier3 },
  ];

  const pct = (val: number) =>
    total > 0 ? `${((val / total) * 100).toFixed(1)}%` : "0%";

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
      <p className="text-sm font-semibold mb-3">Tier Distribution</p>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={TIER_COLORS[index]} />
              ))}
            </Pie>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tooltip formatter={(val: any) => [Number(val).toLocaleString(), "Docs"]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2 flex-1">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TIER_COLORS[index] }}
                />
                <span className="text-[var(--muted-foreground)]">{entry.name}</span>
              </div>
              <span className="tabular-nums font-medium">{pct(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-[var(--muted-foreground)] tabular-nums">
        Total: {totalDocs.toLocaleString()} documents
      </p>
    </div>
  );
}
