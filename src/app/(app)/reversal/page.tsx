"use client";

import { useState } from "react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { Tooltip } from "@/components/tooltip";

export default function ReversalPage() {
  const [documentId, setDocumentId] = useState("");
  const [reason, setReason] = useState("Correction/Reversal");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function createReversal() {
    if (!documentId.trim()) return;
    setLoading(true); setMessage("");
    try {
      const tenantId = getWorkspaceTenantId();
      const res = await fetch(`/api/documents/${documentId.trim()}/reversal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Create reversal failed");
      setMessage(`Reversal created: ${json.data.documentNumber} (${json.data.id})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Create reversal failed");
    } finally { setLoading(false); }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Correction / Reversal</h1>
        <p className="text-sm text-slate-500">Create reversal JV for an approved/exported document</p>
      </div>

      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Original Document ID</label>
            <input
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="UUID of approved/exported document"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <Tooltip side="bottom" content="Creates a new journal entry that exactly reverses (debits↔credits) the original entry. Used to correct errors in posted entries without deleting them — maintains a complete audit trail.">
            <button
              onClick={createReversal}
              disabled={loading || !documentId.trim()}
              className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Reversal JV"}
            </button>
          </Tooltip>
        </div>
      </div>

      {message && <p className="text-sm text-slate-600">{message}</p>}
    </section>
  );
}
