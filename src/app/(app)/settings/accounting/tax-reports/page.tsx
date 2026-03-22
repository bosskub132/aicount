"use client";

import { useEffect, useState } from "react";

export default function AccountingTaxReportsPage() {
  const [tenantId, setTenantId] = useState("");
  const [month, setMonth] = useState("2026-03");
  const [pp30, setPp30] = useState("");
  const [pnd, setPnd] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  async function runTaxReports() {
    if (!tenantId) return;
    const [pp30Res, pndRes] = await Promise.all([
      fetch(`/api/tenants/${tenantId}/tax-report/pp30?month=${month}`, { headers: { "x-tenant-id": tenantId } }),
      fetch(`/api/tenants/${tenantId}/tax-report/pnd353?month=${month}`, { headers: { "x-tenant-id": tenantId } }),
    ]);
    const pp30Json = await pp30Res.json();
    const pndJson = await pndRes.json();
    setPp30(pp30Json.success ? JSON.stringify(pp30Json.data) : pp30Json.error || "PP30 failed");
    setPnd(pndJson.success ? JSON.stringify(pndJson.data) : pndJson.error || "PND failed");
  }

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Tax Reports</h1>
        <p className="text-slate-500">No workspace selected. Please select a workspace to generate tax reports.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Tax Reports</h1>
      <p className="text-slate-600">Generate monthly tax snapshots for PP30 and PND3/53.</p>
      <div className="flex items-center gap-2 text-sm">
        <input value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border px-2 py-1" />
        <button onClick={runTaxReports} className="rounded bg-slate-900 px-3 py-2 text-white">
          Run Reports
        </button>
      </div>
      {pp30 ? <pre className="overflow-x-auto rounded border bg-white p-3 text-xs">{pp30}</pre> : null}
      {pnd ? <pre className="overflow-x-auto rounded border bg-white p-3 text-xs">{pnd}</pre> : null}
    </section>
  );
}
