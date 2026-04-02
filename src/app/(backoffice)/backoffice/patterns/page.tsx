"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/input";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/badge";
import { useMounted } from "@/lib/hooks/use-mounted";

interface PatternRow {
  id: string;
  patternType: string;
  triggerKey: string;
  fieldName: string;
  suggestedValue: string;
  tenantCount: number;
  sampleCount: number;
  agreementRatio: string;
  confidence: string;
  [key: string]: unknown;
}

interface PatternStats {
  totalPatterns: number;
  activePatterns: number;
  coverage: number;
}

export default function PatternsPage() {
  const [page, setPage] = useState(1);
  const [patternType, setPatternType] = useState("");
  const [search, setSearch] = useState("");
  const limit = 20;

  const { data: stats } = useQuery<PatternStats>({
    queryKey: ["backoffice", "pattern-stats"],
    queryFn: () =>
      fetch("/api/backoffice/analytics/patterns").then((r) => r.json()),
  });

  const mounted = useMounted();
  const { data: patterns, isLoading: queryLoading } = useQuery<{
    data: PatternRow[];
    total: number;
  }>({
    queryKey: ["backoffice", "patterns", page, patternType, search],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (patternType) params.set("patternType", patternType);
      if (search) params.set("search", search);
      return fetch(`/api/backoffice/patterns?${params}`).then((r) => r.json());
    },
  });

  const columns = [
    {
      key: "patternType",
      header: "Type",
      render: (row: PatternRow) => (
        <Badge variant="default">{row.patternType}</Badge>
      ),
    },
    {
      key: "triggerKey",
      header: "Trigger Key",
      render: (row: PatternRow) => (
        <code className="text-xs">{row.triggerKey}</code>
      ),
    },
    { key: "fieldName" as const, header: "Field" },
    { key: "suggestedValue" as const, header: "Suggested Value" },
    {
      key: "tenantCount",
      header: "Tenants",
      render: (row: PatternRow) => (
        <span className="tabular-nums">{row.tenantCount}</span>
      ),
    },
    {
      key: "sampleCount",
      header: "Samples",
      render: (row: PatternRow) => (
        <span className="tabular-nums">{row.sampleCount}</span>
      ),
    },
    {
      key: "agreementRatio",
      header: "Agreement",
      render: (row: PatternRow) => {
        const ratio = Number(row.agreementRatio);
        const color =
          ratio >= 0.8
            ? "text-green-600"
            : ratio >= 0.65
              ? "text-blue-600"
              : "text-amber-600";
        return (
          <span className={`font-medium tabular-nums ${color}`}>
            {(ratio * 100).toFixed(0)}%
          </span>
        );
      },
    },
    {
      key: "confidence",
      header: "Confidence",
      render: (row: PatternRow) => {
        const conf = Number(row.confidence);
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${conf * 100}%` }}
              />
            </div>
            <span className="text-xs tabular-nums">{conf.toFixed(2)}</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">
        Community Patterns
      </h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Total Patterns"
          value={String(stats?.totalPatterns ?? 0)}
        />
        <StatCard
          title="Active Patterns"
          value={String(stats?.activePatterns ?? 0)}
          trendValue="Meeting quality bar"
          trend="neutral"
        />
        <StatCard
          title="Pattern Coverage"
          value={`${stats?.coverage ?? 0}%`}
          trendValue="of suggestions from cross-tenant"
          trend="neutral"
        />
      </div>

      <div className="flex items-center gap-3">
        <select
          value={patternType}
          onChange={(e) => {
            setPatternType(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="coa_mapping">COA Mapping</option>
          <option value="wht_rate">WHT Rate</option>
          <option value="smart_default">Smart Default</option>
        </select>
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search trigger key..."
          className="max-w-xs"
        />
      </div>

      {(!mounted || queryLoading) ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={(patterns?.data ?? []) as PatternRow[]}
        />
      )}

      {patterns && patterns.total > limit && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(patterns.total / limit)}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
