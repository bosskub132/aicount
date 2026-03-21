"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type ApprovalRow = {
  id: string;
  issuerName: string | null;
  grandTotal: string | null;
  documentDate: string | null;
  updatedAt: string;
};

export default function ApprovalsPage() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = getWorkspaceTenantId();
    fetch(`/api/documents/approval-queue?tenantId=${tenantId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Load failed");
        setRows(json.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Approvals</h1>
          <p className="text-sm text-slate-500">Checker approval queue</p>
        </div>
        <Link href="/documents" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
          View all documents
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">{row.issuerName || "Unknown issuer"}</p>
              <p className="mt-1 text-xs text-slate-500">Total: {row.grandTotal ? `฿${Number(row.grandTotal).toLocaleString()}` : "-"}</p>
              <p className="text-xs text-slate-400">Updated: {new Date(row.updatedAt).toLocaleString()}</p>
              <span className="mt-2 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                Pending Approval
              </span>
            </article>
          ))}
          {!rows.length && (
            <div className="col-span-full py-12 text-center">
              <p className="text-sm text-slate-400">No pending approvals.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
