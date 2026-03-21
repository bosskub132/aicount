"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type QueryRow = {
  id: string;
  issuerName: string | null;
  documentNumber: string | null;
  status: string;
  updatedAt: string;
};

export default function QueryTrayPage() {
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const tenantId = getWorkspaceTenantId();
    fetch(`/api/documents?tenantId=${tenantId}&status=QUERY`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Failed to load");
        setRows(json.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Query Tray</h1>
          <p className="text-sm text-slate-500">OCR mismatch and unresolved bookkeeping items</p>
        </div>
        <Link href="/documents" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
          View all documents
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-amber-700">Issuer</th>
              <th className="px-4 py-3 text-xs font-medium text-amber-700">Doc No.</th>
              <th className="px-4 py-3 text-xs font-medium text-amber-700">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-amber-700">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">{row.issuerName || "-"}</td>
                <td className="px-4 py-3">{row.documentNumber || "-"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{row.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(row.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No query items.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
