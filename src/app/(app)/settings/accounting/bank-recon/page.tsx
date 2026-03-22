"use client";

import { useEffect, useState } from "react";

export default function AccountingBankReconPage() {
  const [tenantId, setTenantId] = useState("");
  const [fromDate, setFromDate] = useState("2026-03-01");
  const [toDate, setToDate] = useState("2026-03-31");
  const [result, setResult] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  async function runRecon() {
    if (!tenantId) return;
    const response = await fetch(`/api/tenants/${tenantId}/bank-recon?from=${fromDate}&to=${toDate}`, {
      headers: { "x-tenant-id": tenantId },
    });
    const json = await response.json();
    setResult(json.success ? JSON.stringify(json.data) : json.error || "Recon failed");
  }

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Bank Reconciliation</h1>
        <p className="text-slate-500">No workspace selected. Please select a workspace to run bank reconciliation.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Bank Reconciliation</h1>
      <p className="text-slate-600">Compare statements with exported transactions by date range.</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border px-2 py-1" />
        <span>to</span>
        <input value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border px-2 py-1" />
        <button onClick={runRecon} className="rounded bg-slate-900 px-3 py-2 text-white">
          Run Recon
        </button>
      </div>
      {result ? <pre className="overflow-x-auto rounded border bg-white p-3 text-xs">{result}</pre> : null}
    </section>
  );
}
