"use client";

import { useState, useEffect, useRef } from "react";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/skeleton";
import { useBackofficeRules, useBackofficeTenants } from "@/lib/hooks/use-backoffice";

interface ExtractionRule {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  ruleType: string;
  triggerKey: string;
  triggerValue: string;
  fieldName: string;
  ruleText: string;
  deterministicValue: string | null;
  sampleCount: number;
  confidence: number;
  isGraduated: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BackofficeTenant {
  id: string;
  name: string;
}

interface RulesStats {
  total: number;
  graduated: number;
  prompt: number;
  low: number;
  tenantCount: number;
}

interface RulesMeta {
  total: number;
  page: number;
  limit: number;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value * 100, 0), 100);
  const color =
    value >= 0.8
      ? "#059669" // green
      : value >= 0.5
        ? "#2563EB" // blue
        : "#D97706"; // amber

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 rounded-full bg-[var(--muted)] overflow-hidden"
        style={{ width: 48 }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="tabular-nums text-xs text-[var(--muted-foreground)]">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function StatusBadge({ rule }: { rule: ExtractionRule }) {
  if (rule.isGraduated) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success-light)] text-[#065F46]">
        Graduated
      </span>
    );
  }
  if (rule.confidence < 0.5) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--warning-light)] text-[#92400E]">
        Low
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
      Prompt
    </span>
  );
}

const SELECT_CLASS =
  "border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-1.5 text-sm bg-white text-[var(--secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

const BTN_CLASS =
  "text-xs px-3 py-1.5 rounded-[var(--radius-button)] border cursor-pointer";

export default function BackofficeRulesPage() {
  const [filters, setFilters] = useState({
    tenantId: "",
    status: "",
    type: "",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters.search]);

  const queryFilters = {
    tenantId: filters.tenantId || undefined,
    status: filters.status || undefined,
    type: filters.type || undefined,
    search: debouncedSearch || undefined,
    page,
  };

  const { data, isLoading, refetch } = useBackofficeRules(queryFilters);
  const { data: tenantsData } = useBackofficeTenants();

  const rules: ExtractionRule[] = data?.data ?? [];
  const meta: RulesMeta | undefined = data?.meta;
  const stats: RulesStats = data?.stats ?? {
    total: 0,
    graduated: 0,
    prompt: 0,
    low: 0,
    tenantCount: 0,
  };
  const tenants: BackofficeTenant[] = tenantsData ?? [];

  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;
  const startItem = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const endItem = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key !== "search") setPage(1);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleGraduate(ruleId: string) {
    await fetch(`/api/backoffice/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isGraduated: true }),
    });
    refetch();
  }

  async function handleDemote(ruleId: string) {
    await fetch(`/api/backoffice/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isGraduated: false }),
    });
    refetch();
  }

  async function handleDelete(ruleId: string) {
    if (!confirm("Delete this rule? This cannot be undone.")) return;
    await fetch(`/api/backoffice/rules/${ruleId}`, { method: "DELETE" });
    refetch();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Extraction Rules</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Learned extraction rules across all tenants
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5"
            >
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-7 w-20 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              title="Total Rules"
              value={String(stats.total)}
              trendValue={`Across ${stats.tenantCount} tenants`}
            />
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
              <p className="text-xs text-[var(--muted-foreground)]">Graduated</p>
              <p className="mt-1 text-2xl font-bold text-[var(--success)] tabular-nums">
                {stats.graduated}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Deterministic (no AI)</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
              <p className="text-xs text-[var(--muted-foreground)]">Prompt-Injected</p>
              <p className="mt-1 text-2xl font-bold text-[var(--primary)] tabular-nums">
                {stats.prompt}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Active as AI hints</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
              <p className="text-xs text-[var(--muted-foreground)]">Low Confidence</p>
              <p className="mt-1 text-2xl font-bold text-[var(--warning)] tabular-nums">
                {stats.low}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Below 0.50, may need review
              </p>
            </div>
          </>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <select
          className={SELECT_CLASS}
          value={filters.tenantId}
          onChange={(e) => updateFilter("tenantId", e.target.value)}
        >
          <option value="">All Tenants</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          className={SELECT_CLASS}
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="graduated">Graduated</option>
          <option value="prompt">Prompt-Injected</option>
          <option value="low">Low Confidence</option>
        </select>

        <select
          className={SELECT_CLASS}
          value={filters.type}
          onChange={(e) => updateFilter("type", e.target.value)}
        >
          <option value="">All Types</option>
          <option value="issuer_hint">issuer_hint</option>
          <option value="field_pattern">field_pattern</option>
          <option value="format_rule">format_rule</option>
        </select>

        <input
          type="search"
          placeholder="Search rules..."
          className={`${SELECT_CLASS} min-w-[200px]`}
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
        />
      </div>

      {/* Rules Table */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["", "Tenant", "Trigger", "Field", "Type", "Confidence", "Samples", "Status"].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="text-left px-3 py-2 text-xs font-medium uppercase text-[var(--muted-foreground)] border-b border-[var(--border)]"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-2 border-b border-[var(--muted)]">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rules.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-sm text-[var(--muted-foreground)]"
                  >
                    No extraction rules found
                  </td>
                </tr>
              ) : (
                rules.map((rule) => {
                  const isExpanded = expandedId === rule.id;
                  return (
                    <>
                      <tr
                        key={rule.id}
                        className="hover:bg-[var(--muted)]/30 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(rule.id)}
                      >
                        {/* Expand Arrow */}
                        <td className="px-3 py-2 border-b border-[var(--muted)] w-6">
                          <span className="text-[10px] text-[var(--muted-foreground)]">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </td>

                        {/* Tenant */}
                        <td className="px-3 py-2 border-b border-[var(--muted)] font-medium">
                          {rule.tenantName ? (
                            rule.tenantName
                          ) : (
                            <span className="italic text-[var(--muted-foreground)]">Global</span>
                          )}
                        </td>

                        {/* Trigger */}
                        <td className="px-3 py-2 border-b border-[var(--muted)]">
                          <span className="font-mono text-xs">{rule.triggerValue}</span>
                        </td>

                        {/* Field */}
                        <td className="px-3 py-2 border-b border-[var(--muted)]">
                          {rule.fieldName}
                        </td>

                        {/* Type */}
                        <td className="px-3 py-2 border-b border-[var(--muted)]">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--secondary)]">
                            {rule.ruleType}
                          </span>
                        </td>

                        {/* Confidence */}
                        <td className="px-3 py-2 border-b border-[var(--muted)]">
                          <ConfidenceBar value={rule.confidence} />
                        </td>

                        {/* Samples */}
                        <td className="px-3 py-2 border-b border-[var(--muted)] tabular-nums">
                          {rule.sampleCount}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2 border-b border-[var(--muted)]">
                          <StatusBadge rule={rule} />
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${rule.id}-expanded`}>
                          <td
                            colSpan={8}
                            className="px-4 py-4 border-b border-[var(--muted)] bg-[var(--muted)]/20"
                          >
                            {/* Detail Grid */}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-4 text-xs">
                              <div>
                                <p className="font-medium text-[var(--muted-foreground)] mb-1">
                                  Rule Text
                                </p>
                                <p className="text-[var(--foreground)]">{rule.ruleText}</p>
                              </div>

                              {rule.deterministicValue && (
                                <div>
                                  <p className="font-medium text-[var(--muted-foreground)] mb-1">
                                    Deterministic Value
                                  </p>
                                  <p className="font-mono text-[var(--foreground)]">
                                    {rule.deterministicValue}
                                  </p>
                                </div>
                              )}

                              <div>
                                <p className="font-medium text-[var(--muted-foreground)] mb-1">
                                  Created
                                </p>
                                <p className="text-[var(--foreground)]">
                                  {new Date(rule.createdAt).toLocaleString()}
                                </p>
                              </div>

                              <div>
                                <p className="font-medium text-[var(--muted-foreground)] mb-1">
                                  Updated
                                </p>
                                <p className="text-[var(--foreground)]">
                                  {new Date(rule.updatedAt).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                className={`${BTN_CLASS} border-[var(--border)] text-[var(--secondary)] hover:bg-[var(--muted)]`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // eslint-disable-next-line no-console
                                  console.log("Edit rule:", rule.id);
                                }}
                              >
                                Edit Rule
                              </button>

                              {!rule.isGraduated && rule.confidence >= 0.8 && (
                                <button
                                  className={`${BTN_CLASS} border-[var(--success)] text-[var(--success)] hover:bg-[var(--success-light)]`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGraduate(rule.id);
                                  }}
                                >
                                  Graduate
                                </button>
                              )}

                              {rule.isGraduated && (
                                <button
                                  className={`${BTN_CLASS} border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)]`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDemote(rule.id);
                                  }}
                                >
                                  Demote to Prompt
                                </button>
                              )}

                              <button
                                className={`${BTN_CLASS} border-[var(--destructive)] text-[var(--destructive)] hover:bg-red-50`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(rule.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)] tabular-nums">
              {meta.total > 0
                ? `Showing ${startItem}–${endItem} of ${meta.total} rules`
                : "No rules"}
            </p>
            <div className="flex items-center gap-1">
              <button
                className="rounded-[var(--radius-input)] border border-[var(--border)] px-2.5 py-1 text-xs disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <span className="px-2 text-xs tabular-nums text-[var(--muted-foreground)]">
                {page} / {totalPages}
              </span>
              <button
                className="rounded-[var(--radius-input)] border border-[var(--border)] px-2.5 py-1 text-xs disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
