/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type DocRow = {
  id: string;
  status: string;
  direction: string | null;
  issuerName: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  grandTotal: string | null;
  docType: string | null;
  rejectionComment: string | null;
  updatedAt: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  OCR_PROCESSING: "bg-blue-100 text-blue-700",
  QUERY: "bg-amber-100 text-amber-700",
  ACTION_REQUIRED: "bg-orange-100 text-orange-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  REJECTED: "bg-red-100 text-red-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  EXPORTED: "bg-purple-100 text-purple-700",
  VOID: "bg-gray-100 text-gray-600",
};

type Tab = {
  id: string;
  label: string;
  statuses: string[];
  icon: React.ReactNode;
  badge?: (rows: DocRow[]) => number;
};

const TABS: Tab[] = [
  {
    id: "all",
    label: "All",
    statuses: [],
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  },
  {
    id: "action_required",
    label: "Action Required",
    statuses: ["ACTION_REQUIRED"],
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    id: "query",
    label: "Query",
    statuses: ["QUERY"],
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    id: "pending",
    label: "Pending Approval",
    statuses: ["PENDING_APPROVAL"],
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "approved",
    label: "Approved / Exported",
    statuses: ["APPROVED", "EXPORTED"],
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "rejected",
    label: "Rejected",
    statuses: ["REJECTED"],
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function formatAmount(val: string | null) {
  if (!val) return "-";
  const n = Number(val);
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(n);
}

function ActionModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [q, setQ] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");
  const [canSubmitForApproval, setCanSubmitForApproval] = useState(true);
  const [canApproveDocuments, setCanApproveDocuments] = useState(true);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; type: "success" | "error" } | null>(null);
  const [rejectModal, setRejectModal] = useState<DocRow | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [reversalModal, setReversalModal] = useState<DocRow | null>(null);
  const [reversalReason, setReversalReason] = useState("Correction/Reversal");

  useEffect(() => {
    const tid = getWorkspaceTenantId();
    setTenantId(tid);

    fetch("/api/auth/profile", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.success && json.data) setUserId(json.data.id);
      })
      .catch(() => {});

    fetch(`/api/auth/workspace-role?tenantId=${tid}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.data) {
          setCanSubmitForApproval(Boolean(json.data.canSubmitForApproval));
          setCanApproveDocuments(Boolean(json.data.canApproveDocuments));
        }
      })
      .catch(() => {});

    fetch(`/api/documents?tenantId=${tid}`, {
      credentials: "same-origin",
      headers: { "x-tenant-id": tid },
    })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Load failed");
        setRows(json.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  function refreshDocuments() {
    fetch(`/api/documents?tenantId=${tenantId}`, {
      credentials: "same-origin",
      headers: { "x-tenant-id": tenantId },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRows(json.data || []);
      });
  }

  async function submitForApproval(doc: DocRow) {
    setActionLoading(doc.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/submit`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setActionMessage({ id: doc.id, text: "Submitted for approval", type: "success" });
      refreshDocuments();
    } catch (err) {
      setActionMessage({ id: doc.id, text: err instanceof Error ? err.message : "Submit failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  async function approveDocument(doc: DocRow) {
    setActionLoading(doc.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/approve`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ tenantId, approvedBy: userId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setActionMessage({ id: doc.id, text: "Approved", type: "success" });
      refreshDocuments();
    } catch (err) {
      setActionMessage({ id: doc.id, text: err instanceof Error ? err.message : "Approve failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectDocument() {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/documents/${rejectModal.id}/reject`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ tenantId, rejectionComment: rejectComment || "Rejected" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setActionMessage({ id: rejectModal.id, text: "Rejected", type: "success" });
      setRejectModal(null);
      setRejectComment("");
      refreshDocuments();
    } catch (err) {
      setActionMessage({ id: rejectModal.id, text: err instanceof Error ? err.message : "Reject failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  async function reOcr(doc: DocRow) {
    setActionLoading(doc.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/re-ocr`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setActionMessage({ id: doc.id, text: "Re-OCR queued", type: "success" });
      refreshDocuments();
    } catch (err) {
      setActionMessage({ id: doc.id, text: err instanceof Error ? err.message : "Re-OCR failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  async function createReversal() {
    if (!reversalModal) return;
    setActionLoading(reversalModal.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/documents/${reversalModal.id}/reversal`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ tenantId, uploadedBy: userId, reason: reversalReason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setActionMessage({ id: reversalModal.id, text: `Reversal created: ${json.data.documentNumber}`, type: "success" });
      setReversalModal(null);
      setReversalReason("Correction/Reversal");
      refreshDocuments();
    } catch (err) {
      setActionMessage({ id: reversalModal.id, text: err instanceof Error ? err.message : "Reversal failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  const tab = TABS.find((t) => t.id === activeTab)!;
  const filtered = rows.filter((row) => {
    const matchQ = `${row.status} ${row.issuerName || ""} ${row.documentNumber || ""}`
      .toLowerCase()
      .includes(q.toLowerCase());
    if (tab.statuses.length === 0) return matchQ;
    return tab.statuses.includes(row.status) && matchQ;
  });

  const tabCounts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.id] = t.statuses.length === 0
      ? rows.length
      : rows.filter((r) => t.statuses.includes(r.status)).length;
    return acc;
  }, {});

  function renderActions(doc: DocRow) {
    const isLoading = actionLoading === doc.id;
    const msg = actionMessage?.id === doc.id ? actionMessage : null;

    return (
      <div className="mt-3 space-y-2">
        {msg && (
          <p className={`text-[11px] ${msg.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {/* ACTION_REQUIRED: Submit for approval + Re-OCR + View */}
          {doc.status === "ACTION_REQUIRED" && (
            <>
              {canSubmitForApproval ? (
                <button
                  onClick={(e) => { e.preventDefault(); submitForApproval(doc); }}
                  disabled={isLoading}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? "..." : "Submit for Approval"}
                </button>
              ) : (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
                  Maker submit required
                </span>
              )}
              <button
                onClick={(e) => { e.preventDefault(); reOcr(doc); }}
                disabled={isLoading}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Re-OCR
              </button>
            </>
          )}

          {/* QUERY: Re-OCR */}
          {doc.status === "QUERY" && (
            <button
              onClick={(e) => { e.preventDefault(); reOcr(doc); }}
              disabled={isLoading}
              className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {isLoading ? "..." : "Re-process OCR"}
            </button>
          )}

          {/* PENDING_APPROVAL: Approve / Reject */}
          {doc.status === "PENDING_APPROVAL" && (
            <>
              {canApproveDocuments ? (
                <>
                  <button
                    onClick={(e) => { e.preventDefault(); approveDocument(doc); }}
                    disabled={isLoading}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); setRejectModal(doc); }}
                    disabled={isLoading}
                    className="rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              ) : (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700">
                  Use Approvals (checker)
                </span>
              )}
            </>
          )}

          {/* APPROVED / EXPORTED: Reversal */}
          {(doc.status === "APPROVED" || doc.status === "EXPORTED") && (
            <button
              onClick={(e) => { e.preventDefault(); setReversalModal(doc); }}
              disabled={isLoading}
              className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Create Reversal
            </button>
          )}

          {/* REJECTED: Re-submit or Re-OCR */}
          {doc.status === "REJECTED" && (
            <>
              {canSubmitForApproval ? (
                <button
                  onClick={(e) => { e.preventDefault(); submitForApproval(doc); }}
                  disabled={isLoading}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? "..." : "Re-submit"}
                </button>
              ) : (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
                  Maker re-submit required
                </span>
              )}
              <button
                onClick={(e) => { e.preventDefault(); reOcr(doc); }}
                disabled={isLoading}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Re-OCR
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Preview</h1>
          <p className="text-sm text-slate-500">{filtered.length} documents</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search issuer, doc number..."
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          />
          <Link
            href="/upload"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            + Upload
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => {
          const count = tabCounts[t.id];
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {t.icon}
              {t.label}
              {count > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab description */}
      {activeTab === "action_required" && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
          <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-orange-700">
            These documents have been processed by OCR and need your review. Verify the extracted data, then submit for approval or re-process the OCR.
          </p>
        </div>
      )}
      {activeTab === "query" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-amber-700">
            OCR mismatch or unresolved bookkeeping items. Re-process the OCR to resolve these queries.
          </p>
        </div>
      )}
      {activeTab === "pending" && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5">
          <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-yellow-700">
            These documents are waiting for checker approval. Review and approve or reject each document.
          </p>
        </div>
      )}
      {activeTab === "approved" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-emerald-700">
            Approved and exported documents. You can create a reversal JV if a correction is needed.
          </p>
        </div>
      )}
      {activeTab === "rejected" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-red-700">
            These documents were rejected by the checker. Review the rejection reason, fix the issues, then re-submit.
          </p>
        </div>
      )}

      {/* Content */}
      {loading && <p className="text-sm text-slate-400">Loading documents...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => {
            const isRevenue = row.direction === "REVENUE";
            return (
              <div
                key={row.id}
                className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/extractions?docId=${row.id}`}
                      className="text-sm font-semibold text-slate-800 hover:text-blue-600"
                    >
                      {row.issuerName || "Unknown"}
                    </Link>
                    {row.direction && (
                      <span className={`ml-1.5 text-[10px] ${isRevenue ? "text-emerald-500" : "text-red-500"}`}>
                        {isRevenue ? "Revenue" : "Expense"}
                      </span>
                    )}
                  </div>
                  <p className={`text-lg font-bold ${isRevenue ? "text-emerald-600" : "text-red-600"}`}>
                    {isRevenue ? "+" : "-"}
                    {formatAmount(row.grandTotal)}
                  </p>
                </div>

                {/* Details */}
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {row.documentDate && <p>Date: {row.documentDate}</p>}
                  {row.documentNumber && <p>Doc: {row.documentNumber}</p>}
                  <p>Created: {new Date(row.createdAt).toLocaleDateString()}</p>
                </div>

                {/* Rejection comment */}
                {row.status === "REJECTED" && row.rejectionComment && (
                  <div className="mt-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
                    <span className="font-medium">Rejection reason:</span> {row.rejectionComment}
                  </div>
                )}

                {/* Status badge + type */}
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      STATUS_COLORS[row.status] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {row.status.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    {row.docType && (
                      <span className="text-[10px] text-slate-400">{row.docType}</span>
                    )}
                    <Link
                      href={`/extractions?docId=${row.id}`}
                      className="text-[10px] text-blue-500 hover:underline"
                    >
                      View details →
                    </Link>
                  </div>
                </div>

                {/* Inline actions */}
                {renderActions(row)}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="mt-2 text-sm text-slate-400">
                {activeTab === "all" ? "No documents found." : `No ${tab.label.toLowerCase()} documents.`}
              </p>
              {activeTab === "all" && (
                <Link href="/upload" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                  Upload your first document
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <ActionModal title="Reject Document" onClose={() => setRejectModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Rejecting <strong>{rejectModal.issuerName || rejectModal.id}</strong>. The maker will be notified.
          </p>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Reason for rejection..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setRejectModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={rejectDocument}
              disabled={actionLoading === rejectModal.id}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === rejectModal.id ? "Rejecting..." : "Reject Document"}
            </button>
          </div>
        </ActionModal>
      )}

      {/* Reversal Modal */}
      {reversalModal && (
        <ActionModal title="Create Reversal JV" onClose={() => setReversalModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Creating a reversal for <strong>{reversalModal.issuerName || reversalModal.id}</strong>{" "}
            ({reversalModal.documentNumber || "no doc number"}).
            This will create a new document with reversed journal entries.
          </p>
          <div>
            <label className="text-xs font-medium text-slate-600">Reason</label>
            <input
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setReversalModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={createReversal}
              disabled={actionLoading === reversalModal.id}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === reversalModal.id ? "Creating..." : "Create Reversal"}
            </button>
          </div>
        </ActionModal>
      )}
    </section>
  );
}
