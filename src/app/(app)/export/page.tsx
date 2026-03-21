"use client";

import { useEffect, useMemo, useState } from "react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

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

const GROUP_COLORS: Record<string, { bg: string; icon: string }> = {
  revenue: { bg: "border-emerald-200 bg-emerald-50", icon: "text-emerald-500" },
  expense: { bg: "border-red-200 bg-red-50", icon: "text-red-500" },
  master: { bg: "border-blue-200 bg-blue-50", icon: "text-blue-500" },
  journal: { bg: "border-purple-200 bg-purple-50", icon: "text-purple-500" },
};

export default function ExportPage() {
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [groups, setGroups] = useState<{ strong: ExportDoc[]; suitable: ExportDoc[]; manual: ExportDoc[] }>({
    strong: [], suitable: [], manual: [],
  });
  const [activeGroup, setActiveGroup] = useState<"strong" | "suitable" | "manual">("strong");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<"document" | "item">("document");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const tenantId = getWorkspaceTenantId();
    fetch(`/api/export/templates?tenantId=${tenantId}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Failed");
        setTemplates(json.data || []);
      })
      .catch((err) => setResult(err instanceof Error ? err.message : "Failed to load templates"));
  }, []);

  async function loadTemplateDocuments(templateId: string) {
    const tenantId = getWorkspaceTenantId();
    setSelectedTemplateId(templateId);
    setSelectedIds([]);
    const res = await fetch(`/api/export/templates?tenantId=${tenantId}&templateId=${templateId}`, {
      credentials: "same-origin",
    });
    const json = await res.json();
    if (json.success) setGroups(json.data.groups);
    else setResult(json.error || "Failed");
  }

  async function runExport(): Promise<{ filePath?: string; fileName?: string } | null> {
    setLoading(true);
    setResult("");
    try {
      const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
      const res = await fetch("/api/export/express", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: getWorkspaceTenantId(),
          period: "month",
          journalType: selectedTemplate?.journalTypes?.[0] || "",
          returnContent: false,
          exportMode,
          selectedDocumentIds: selectedIds,
          templateId: selectedTemplateId || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Export failed");
      setResult(`Export completed: ${json.data.exportedCount ?? "done"} record(s)`);
      return {
        filePath: json.data?.filePath,
        fileName: json.data?.filePath?.split("/").pop() || "express-export.xlsx",
      };
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Export failed");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function triggerBrowserDownload(filePath: string, fileName: string) {
    const url = filePath.startsWith("/") ? `${window.location.origin}${filePath}` : filePath;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const visibleDocs = groups[activeGroup];
  const stats = useMemo(() => {
    const picked = visibleDocs.filter((d) => selectedIds.includes(d.id));
    const total = picked.reduce((s, d) => s + Number(d.grandTotal || 0), 0);
    const dates = picked.map((d) => d.documentDate).filter(Boolean).sort();
    return { records: picked.length, total, from: dates[0] || "-", to: dates[dates.length - 1] || "-" };
  }, [selectedIds, visibleDocs]);

  // Group templates by direction/group
  const revenueTemplates = templates.filter((t) => t.direction === "REVENUE" || t.templateGroup === "revenue");
  const expenseTemplates = templates.filter((t) => t.direction === "EXPENSE" || t.templateGroup === "expense");
  const otherTemplates = templates.filter((t) => !revenueTemplates.includes(t) && !expenseTemplates.includes(t));

  function TemplateSection({ title, items, colorKey }: { title: string; items: TemplateCard[]; colorKey: string }) {
    if (!items.length) return null;
    const colors = GROUP_COLORS[colorKey] || GROUP_COLORS.journal;
    return (
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <button
              key={t.id}
              onClick={() => loadTemplateDocuments(t.id)}
              className={`rounded-xl border p-4 text-left transition-all ${
                selectedTemplateId === t.id ? "border-blue-400 ring-2 ring-blue-100" : colors.bg
              }`}
            >
              <p className="text-sm font-semibold text-slate-800">{t.name}</p>
              <div className="mt-2 flex gap-2">
                {t.strong > 0 && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{t.strong} strong</span>}
                {t.suitable > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{t.suitable} suitable</span>}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">{t.approvedCandidates} candidates</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Select Export Template</h1>
        <p className="text-sm text-slate-500">
          Choose a template that matches your documents. The download is an Excel file (.xlsx) formatted for Express Accounting Software.
        </p>
      </div>

      <div className="space-y-5">
        <TemplateSection title="Revenue" items={revenueTemplates} colorKey="revenue" />
        <TemplateSection title="Expense" items={expenseTemplates} colorKey="expense" />
        <TemplateSection title="Other Templates" items={otherTemplates} colorKey="journal" />
        {!templates.length && <p className="text-sm text-slate-400">No templates configured yet.</p>}
      </div>

      {selectedTemplateId && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2 border-b pb-3">
            {(["strong", "suitable", "manual"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeGroup === g ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {g === "strong" ? "Strong" : g === "suitable" ? "Suitable" : "Other"} ({groups[g].length})
              </button>
            ))}
            <button
              onClick={() => setSelectedIds(visibleDocs.map((d) => d.id))}
              className="ml-auto text-xs text-blue-600 hover:underline"
            >
              Select all matched ({visibleDocs.length})
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-medium uppercase text-slate-500">Export Mode</label>
              <select
                value={exportMode}
                onChange={(e) => setExportMode(e.target.value as "document" | "item")}
                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
              >
                <option value="document">Document Level - 1 document = 1 row</option>
                <option value="item">Item Level - 1 item = 1 row</option>
              </select>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Records: {stats.records}</div>
            <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              Total: ฿{stats.total.toLocaleString()} ({stats.from} to {stats.to})
            </div>
          </div>

          <div className="mt-3 max-h-64 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Document Name</th>
                  <th className="px-3 py-2">Counterparty</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocs.map((doc) => (
                  <tr key={doc.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) => e.target.checked ? [...prev, doc.id] : prev.filter((id) => id !== doc.id))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">{doc.documentDate || "-"}</td>
                    <td className="px-3 py-2">{doc.documentNumber || "-"}</td>
                    <td className="px-3 py-2">{doc.issuerName || "-"}</td>
                    <td className="px-3 py-2 text-right">฿{Number(doc.grandTotal || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {!visibleDocs.length && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No documents in this group.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <p className="text-xs text-slate-500">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedIds([])} className="rounded-lg border px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => setShowPreview(true)}
                disabled={!selectedIds.length}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Preview export ({selectedIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Express export preview</h2>
              <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex gap-4 text-xs text-slate-600">
                <span>Records: {stats.records}</span>
                <span>Total: ฿{stats.total.toLocaleString()}</span>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-medium text-emerald-800">Ready to Download</p>
                <p className="mt-1 text-[10px] text-emerald-600">
                  The generated file is an Excel spreadsheet (.xlsx) for import into Express.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowPreview(false)} className="flex-1 rounded-lg border px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                  Back to Selection
                </button>
                <button
                  onClick={async () => {
                    const data = await runExport();
                    if (data?.filePath && data?.fileName) {
                      triggerBrowserDownload(data.filePath, data.fileName);
                    }
                    setShowPreview(false);
                  }}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Exporting..." : "Download Excel file"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && <p className="text-sm text-slate-600">{result}</p>}
    </section>
  );
}
