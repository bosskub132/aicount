"use client";

import { useEffect, useState } from "react";

type AssignmentRow = {
  assignmentId: string;
  userId: string;
  assignmentRole: "maker" | "checker";
  email: string;
  name: string | null;
};

export default function TenantAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"maker" | "checker">("maker");
  const [message, setMessage] = useState("");

  const tenantId = typeof window !== "undefined" ? window.location.pathname.split("/")[3] : "";

  async function load() {
    if (!tenantId) return;
    const response = await fetch(`/api/tenants/${tenantId}/assignments`);
    const json = await response.json();
    if (json.success) setRows(json.data || []);
    else setMessage(json.error || "Failed to load assignments");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function addAssignment() {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const json = await response.json();
    setMessage(json.success ? "Assignment created" : json.error || "Create failed");
    if (json.success) {
      setUserId("");
      await load();
    }
  }

  async function removeAssignment(assignmentId: string) {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/assignments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    });
    const json = await response.json();
    setMessage(json.success ? "Assignment removed" : json.error || "Remove failed");
    if (json.success) await load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Staff Assignments</h1>
      <p className="text-slate-600">Manage maker/checker assignments for this tenant workspace.</p>
      <div className="flex flex-wrap items-center gap-2 rounded border bg-white p-3 text-sm">
        <input
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder="User UUID"
          className="w-full max-w-sm rounded border px-2 py-1"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as "maker" | "checker")}
          className="rounded border px-2 py-1"
        >
          <option value="maker">maker</option>
          <option value="checker">checker</option>
        </select>
        <button onClick={addAssignment} className="rounded bg-slate-900 px-3 py-2 text-white">
          Add
        </button>
      </div>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.assignmentId} className="border-t">
                <td className="px-3 py-2">{row.name || "-"}</td>
                <td className="px-3 py-2">{row.email}</td>
                <td className="px-3 py-2">{row.assignmentRole}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => removeAssignment(row.assignmentId)}
                    className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-3 py-2 text-slate-500" colSpan={4}>
                  No assignments.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

