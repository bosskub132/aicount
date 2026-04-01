"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// Recharts cannot read CSS variables — hardcode hex values with comments
const PRIMARY_BLUE = "#2563EB"; // var(--primary)
const SUCCESS_GREEN = "#059669"; // var(--success)
const BORDER_GRAY = "#E2E8F0"; // var(--border)
const MUTED_FG = "#64748B"; // var(--muted-foreground)

interface DailyCostDataPoint {
  date: string;
  dailyCost: number;
  cumulativeCost: number;
}

interface DailyCostChartProps {
  data: DailyCostDataPoint[];
  budgetPace?: number;
}

export function DailyCostChart({ data, budgetPace }: DailyCostChartProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
      <p className="text-sm font-semibold mb-3">Daily AI Cost (Cumulative)</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER_GRAY} />
          <XAxis
            dataKey="date"
            tickFormatter={(val: string) => val.slice(8)}
            tick={{ fontSize: 11, fill: MUTED_FG }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(val: number) => `$${val.toFixed(2)}`}
            tick={{ fontSize: 11, fill: MUTED_FG }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(val: any) => [`$${Number(val).toFixed(4)}`, "Cumulative Cost"]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => `Date: ${label}`}
          />
          {budgetPace !== undefined && (
            <ReferenceLine
              y={budgetPace}
              stroke={SUCCESS_GREEN}
              strokeDasharray="4 4"
              label={{ value: "Budget Pace", fill: SUCCESS_GREEN, fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="cumulativeCost"
            stroke={PRIMARY_BLUE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: PRIMARY_BLUE }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span
          className="inline-block h-2 w-6 rounded-full"
          style={{ backgroundColor: PRIMARY_BLUE }}
        />
        <span>Cumulative Cost</span>
        {budgetPace !== undefined && (
          <>
            <span
              className="inline-block h-[2px] w-6 border-t-2 border-dashed"
              style={{ borderColor: SUCCESS_GREEN }}
            />
            <span>Budget Pace</span>
          </>
        )}
      </div>
    </div>
  );
}
