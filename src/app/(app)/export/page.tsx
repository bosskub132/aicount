"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  Download,
  FileSpreadsheet,
  History,
  PackageOpen,
} from "lucide-react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import {
  useExportTemplates,
  useExportHistory,
  useExportMutation,
} from "@/lib/hooks/use-export";
import { useToast } from "@/lib/stores/ui-store";
import { Tabs } from "@/components/tabs";
import { Card } from "@/components/card";
import { DataTable, type Column } from "@/components/data-table";
import { RadioGroup } from "@/components/radio-group";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Modal } from "@/components/modal";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateCard = {
  id: string;
  name: string;
  strong: number;
  suitable: number;
  approvedCandidates: number;
  journalTypes: string[];
  direction?: string;
  templateGroup?: string;
};

type ExportDoc = {
  id: string;
  documentNumber: string | null;
  issuerName: string | null;
  documentDate: string | null;
  grandTotal: string | null;
};

type DocGroups = {
  strong: ExportDoc[];
  suitable: ExportDoc[];
  manual: ExportDoc[];
};

type HistoryRow = {
  id: string;
  createdAt: string;
  templateName: string;
  recordCount: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROUP_COLORS: Record<string, { ring: string; bg: string }> = {
  revenue: { ring: "ring-emerald-300", bg: "border-emerald-200 bg-emerald-50" },
  expense: { ring: "ring-red-300", bg: "border-red-200 bg-red-50" },
  other: { ring: "ring-purple-300", bg: "border-purple-200 bg-purple-50" },
};

const MATCH_TABS = [
  { label: "Strong", value: "strong" },
  { label: "Suitable", value: "suitable" },
  { label: "Other", value: "manual" },
] as const;

const EXPORT_MODE_OPTIONS = [
  { label: "Document Level - 1 document = 1 row", value: "document" },
  { label: "Item Level - 1 item = 1 row", value: "item" },
];

const PAGE_TABS = [
  { label: "Export", value: "export" },
  { label: "History", value: "history" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function categoriseTemplates(templates: TemplateCard[]) {
  const revenue: TemplateCard[] = [];
  const expense: TemplateCard[] = [];
  const other: TemplateCard[] = [];

  for (const t of templates) {
    if (t.direction === "REVENUE" || t.templateGroup === "revenue") {
      revenue.push(t);
    } else if (t.direction === "EXPENSE" || t.templateGroup === "expense") {
      expense.push(t);
    } else {
      other.push(t);
    }
  }
  return { revenue, expense, other };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TemplateSection({
  title,
  items,
  colorKey,
  selectedId,
  onSelect,
}: {
  title: string;
  items: TemplateCard[];
  colorKey: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!items.length) return null;
  const colors = GROUP_COLORS[colorKey] ?? GROUP_COLORS.other;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => {
          const isSelected = selectedId === t.id;
          return (
            <Card
              key={t.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? `ring-2 ${colors.ring} border-[var(--primary)]`
                  : `${colors.bg} hover:shadow-[var(--shadow-sm)]`
              }`}
            >
              <button
                className="w-full text-left"
                onClick={() => onSelect(t.id)}
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {t.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.strong > 0 && (
                    <Badge variant="approved">{t.strong} strong</Badge>
                  )}
                  {t.suitable > 0 && (
                    <Badge variant="pending">{t.suitable} suitable</Badge>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                  {t.approvedCandidates} approved candidates
                </p>
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document columns for DataTable
// ---------------------------------------------------------------------------

const DOC_COLUMNS: Column<ExportDoc & Record<string, unknown>>[] = [
  {
    key: "documentDate",
    header: "Date",
    render: (row) => (row.documentDate ? formatDate(String(row.documentDate)) : "-"),
  },
  {
    key: "documentNumber",
    header: "Document",
    render: (row) => row.documentNumber || "-",
  },
  {
    key: "issuerName",
    header: "Counterparty",
    render: (row) => row.issuerName || "-",
  },
  {
    key: "grandTotal",
    header: "Amount",
    align: "right",
    render: (row) => `฿${Number(row.grandTotal || 0).toLocaleString()}`,
  },
];

// ---------------------------------------------------------------------------
// History columns
// ---------------------------------------------------------------------------

function makeHistoryColumns(
  onDownload: (id: string) => void,
): Column<HistoryRow & Record<string, unknown>>[] {
  return [
    {
      key: "createdAt",
      header: "Date",
      render: (row) => formatDate(String(row.createdAt)),
    },
    { key: "templateName", header: "Template" },
    {
      key: "recordCount",
      header: "Records",
      align: "right",
      render: (row) => String(row.recordCount ?? 0),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      sortable: false,
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={() => onDownload(String(row.id))}
        >
          Download
        </Button>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ExportPage() {
  const toast = useToast();
  const mounted = useMounted();

  // Page-level state
  const [activePageTab, setActivePageTab] = useState("export");

  // Export tab state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [activeGroup, setActiveGroup] = useState<"strong" | "suitable" | "manual">("strong");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<"document" | "item">("document");
  const [showPreview, setShowPreview] = useState(false);

  // Data fetching
  const {
    data: templates = [] as TemplateCard[],
    isLoading: queryTemplatesLoading,
  } = useExportTemplates();

  const templatesLoading = !mounted || queryTemplatesLoading;

  const tenantId = getWorkspaceTenantId();

  const {
    data: templateDocs,
    isLoading: queryDocsLoading,
  } = useQuery<{ groups: DocGroups }>({
    queryKey: ["export-template-docs", tenantId, selectedTemplateId],
    queryFn: async () => {
      const res = await fetch(
        `/api/export/templates?tenantId=${tenantId}&templateId=${selectedTemplateId}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!selectedTemplateId && !!tenantId,
  });

  const docsLoading = !mounted || queryDocsLoading;

  const {
    data: historyData = [] as HistoryRow[],
    isLoading: queryHistoryLoading,
  } = useExportHistory();

  const historyLoading = !mounted || queryHistoryLoading;

  const exportMutation = useExportMutation();

  // Derived
  const groups: DocGroups = useMemo(
    () => templateDocs?.groups ?? { strong: [], suitable: [], manual: [] },
    [templateDocs?.groups],
  );
  const visibleDocs = groups[activeGroup];
  const { revenue, expense, other } = useMemo(
    () => categoriseTemplates(templates as TemplateCard[]),
    [templates],
  );

  const stats = useMemo(() => {
    const allDocs = [...groups.strong, ...groups.suitable, ...groups.manual];
    const picked = allDocs.filter((d) => selectedIds.includes(d.id));
    const total = picked.reduce((s, d) => s + Number(d.grandTotal || 0), 0);
    const dates = picked
      .map((d) => d.documentDate)
      .filter(Boolean)
      .sort();
    return {
      records: picked.length,
      total,
      from: dates[0] || "-",
      to: dates[dates.length - 1] || "-",
    };
  }, [selectedIds, groups]);

  // Handlers
  const handleTemplateSelect = useCallback((id: string) => {
    setSelectedTemplateId(id);
    setSelectedIds([]);
    setActiveGroup("strong");
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(visibleDocs.map((d) => d.id));
  }, [visibleDocs]);

  const handleDocSelect = useCallback((selected: (ExportDoc & Record<string, unknown>)[]) => {
    setSelectedIds(selected.map((d) => String(d.id)));
  }, []);

  const handleDownloadExport = useCallback(
    async () => {
      const selectedTemplate = (templates as TemplateCard[]).find(
        (t) => t.id === selectedTemplateId,
      );
      try {
        const data = await exportMutation.mutateAsync({
          tenantId,
          templateId: selectedTemplateId,
          selectedDocumentIds: selectedIds,
          exportMode,
          journalType: selectedTemplate?.journalTypes?.[0] || "",
        });
        toast.success(`Export completed: ${data.exportedCount ?? selectedIds.length} record(s)`);

        if (data.id) {
          window.open(`/api/export/download/${data.id}`, "_blank", "noopener,noreferrer");
        } else if (data.filePath) {
          const url = data.filePath.startsWith("/")
            ? `${window.location.origin}${data.filePath}`
            : data.filePath;
          window.open(url, "_blank", "noopener,noreferrer");
        }
        setShowPreview(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed");
      }
    },
    [tenantId, selectedTemplateId, selectedIds, exportMode, templates, exportMutation, toast],
  );

  const handleHistoryDownload = useCallback((id: string) => {
    window.open(`/api/export/download/${id}`, "_blank", "noopener,noreferrer");
  }, []);

  const historyColumns = useMemo(
    () => makeHistoryColumns(handleHistoryDownload),
    [handleHistoryDownload],
  );

  // Match-strength tabs with counts
  const matchTabs = MATCH_TABS.map((t) => ({
    label: t.label,
    value: t.value,
    count: groups[t.value].length,
  }));

  // Preview selected docs
  const previewDocs = useMemo(() => {
    const allDocs = [...groups.strong, ...groups.suitable, ...groups.manual];
    return allDocs.filter((d) => selectedIds.includes(d.id));
  }, [groups, selectedIds]);

  // Cast helpers for DataTable (which expects Record<string, unknown>)
  const visibleDocsForTable = visibleDocs as (ExportDoc & Record<string, unknown>)[];
  const historyForTable = (historyData as HistoryRow[]) as (HistoryRow & Record<string, unknown>)[];
  const previewDocsForTable = previewDocs as (ExportDoc & Record<string, unknown>)[];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Export to Express
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Generate Excel files (.xlsx) formatted for import into Express Accounting Software.
        </p>
      </div>

      {/* Page tabs */}
      <Tabs tabs={PAGE_TABS} activeTab={activePageTab} onChange={setActivePageTab} />

      {/* ================================================================= */}
      {/* EXPORT TAB                                                        */}
      {/* ================================================================= */}
      {activePageTab === "export" && (
        <div className="space-y-6">
          {/* Loading skeleton */}
          {templatesLoading && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rect" height="100px" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!templatesLoading && !(templates as TemplateCard[]).length && (
            <EmptyState
              icon={<PackageOpen className="h-10 w-10" />}
              title="No export templates"
              description="Templates will appear here once configured for your workspace."
            />
          )}

          {/* Template cards grouped by direction */}
          {!templatesLoading && (templates as TemplateCard[]).length > 0 && (
            <div className="space-y-5">
              <TemplateSection
                title="Revenue"
                items={revenue}
                colorKey="revenue"
                selectedId={selectedTemplateId}
                onSelect={handleTemplateSelect}
              />
              <TemplateSection
                title="Expense"
                items={expense}
                colorKey="expense"
                selectedId={selectedTemplateId}
                onSelect={handleTemplateSelect}
              />
              <TemplateSection
                title="Other"
                items={other}
                colorKey="other"
                selectedId={selectedTemplateId}
                onSelect={handleTemplateSelect}
              />
            </div>
          )}

          {/* Document selection panel */}
          {selectedTemplateId && (
            <Card>
              {/* Match-strength sub-tabs + select all */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <Tabs tabs={matchTabs} activeTab={activeGroup} onChange={(v) => setActiveGroup(v as "strong" | "suitable" | "manual")} />
                <Button variant="link" size="sm" onClick={handleSelectAll}>
                  Select all matched ({visibleDocs.length})
                </Button>
              </div>

              {/* Export mode + stats */}
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-1">
                  <p className="mb-1.5 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                    Export Mode
                  </p>
                  <RadioGroup
                    name="exportMode"
                    options={EXPORT_MODE_OPTIONS}
                    value={exportMode}
                    onChange={(v) => setExportMode(v as "document" | "item")}
                  />
                </div>
                <StatCard title="Selected Records" value={String(stats.records)} />
                <StatCard
                  title="Total Amount"
                  value={`฿${stats.total.toLocaleString()}`}
                />
                <StatCard
                  title="Date Range"
                  value={`${stats.from} - ${stats.to}`}
                />
              </div>

              {/* Document table */}
              <div className="mt-4">
                {docsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} variant="text" height="36px" />
                    ))}
                  </div>
                ) : (
                  <DataTable
                    columns={DOC_COLUMNS}
                    data={visibleDocsForTable}
                    selectable
                    onSelect={handleDocSelect}
                    emptyMessage="No documents in this group."
                  />
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
                <p className="text-sm text-[var(--muted-foreground)]">
                  {selectedIds.length} document{selectedIds.length !== 1 ? "s" : ""} selected
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedIds([])}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    size="sm"
                    disabled={!selectedIds.length}
                    icon={<FileSpreadsheet className="h-4 w-4" />}
                    onClick={() => setShowPreview(true)}
                  >
                    Preview ({selectedIds.length})
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* HISTORY TAB                                                       */}
      {/* ================================================================= */}
      {activePageTab === "history" && (
        <div>
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="text" height="40px" />
              ))}
            </div>
          ) : !(historyData as HistoryRow[]).length ? (
            <EmptyState
              icon={<History className="h-10 w-10" />}
              title="No export history"
              description="Past exports will appear here after your first download."
            />
          ) : (
            <DataTable
              columns={historyColumns}
              data={historyForTable}
              emptyMessage="No export history yet."
            />
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* PREVIEW MODAL                                                     */}
      {/* ================================================================= */}
      <Modal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title="Export Preview"
        size="lg"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowPreview(false)}>
              Back to Selection
            </Button>
            <Button
              loading={exportMutation.isPending}
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadExport}
            >
              Download Excel
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard title="Records" value={String(stats.records)} />
            <StatCard title="Total" value={`฿${stats.total.toLocaleString()}`} />
            <StatCard title="Date Range" value={`${stats.from} - ${stats.to}`} />
          </div>

          {/* Summary table */}
          <DataTable
            columns={DOC_COLUMNS}
            data={previewDocsForTable}
            emptyMessage="No documents selected."
          />

          <div className="rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-800">Ready to Download</p>
            <p className="mt-1 text-[11px] text-emerald-600">
              The generated file is an Excel spreadsheet (.xlsx) formatted for Express Accounting Software.
            </p>
          </div>
        </div>
      </Modal>
    </section>
  );
}
