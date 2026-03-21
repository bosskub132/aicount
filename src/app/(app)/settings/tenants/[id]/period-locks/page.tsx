"use client";

import { useState } from "react";

export default function TenantPeriodLocksPage() {
  const [period, setPeriod] = useState("2026-03");
  const [message, setMessage] = useState("");

  async function lockPeriod() {
    setMessage("");
    const tenantId = window.location.pathname.split("/")[3];
    const response = await fetch(`/api/tenants/${tenantId}/period-locks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodMonth: period }),
    });
    const json = await response.json();
    setMessage(json.success ? "Period locked" : json.error || "Lock failed");
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Period Locks</h1>
      <p className="text-slate-600">Lock accounting month to prevent post-close changes.</p>
      <div className="flex items-center gap-2">
        <input
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          className="rounded border px-2 py-1 text-sm"
          placeholder="YYYY-MM"
        />
        <button onClick={lockPeriod} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Lock
        </button>
      </div>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}

