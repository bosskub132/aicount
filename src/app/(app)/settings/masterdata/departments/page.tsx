"use client";

import { useEffect, useState } from "react";

type DepartmentRow = {
  id: string;
  deptCode: string;
  deptName: string;
};

export default function MasterDataDepartmentsPage() {
  const [tenantId, setTenantId] = useState("");

  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [deptCode, setDeptCode] = useState("");
  const [deptName, setDeptName] = useState("");
  const [editId, setEditId] = useState("");
  const [editDeptCode, setEditDeptCode] = useState("");
  const [editDeptName, setEditDeptName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  async function load() {
    if (!tenantId) return;
    const response = await fetch(`/api/tenants/${tenantId}/departments`, {
      headers: { "x-tenant-id": tenantId },
    });
    const json = (await response.json()) as { success: boolean; data?: DepartmentRow[]; error?: string };
    if (json.success) setRows(json.data || []);
    else setMessage(json.error || "Failed to load departments");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function createDepartment() {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ deptCode, deptName }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Department created" : json.error || "Create failed");
    if (json.success) {
      setDeptCode("");
      setDeptName("");
      await load();
    }
  }

  async function removeDepartment(id: string) {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/departments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Department removed" : json.error || "Remove failed");
    if (json.success) await load();
  }

  function startEdit(row: DepartmentRow) {
    setEditId(row.id);
    setEditDeptCode(row.deptCode);
    setEditDeptName(row.deptName);
  }

  function cancelEdit() {
    setEditId("");
    setEditDeptCode("");
    setEditDeptName("");
  }

  async function saveEdit() {
    if (!editId) return;
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/departments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ id: editId, deptCode: editDeptCode, deptName: editDeptName }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Department updated" : json.error || "Update failed");
    if (json.success) {
      cancelEdit();
      await load();
    }
  }

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="text-slate-500">No workspace selected. Please select a workspace to manage departments.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Departments</h1>
      <p className="text-slate-600">Create and manage department/cost center data for this tenant.</p>

      <div className="grid gap-2 rounded border bg-white p-3 text-sm sm:grid-cols-2">
        <input className="rounded border px-2 py-1" placeholder="Department code" value={deptCode} onChange={(e) => setDeptCode(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
        <button onClick={createDepartment} className="rounded bg-slate-900 px-3 py-2 text-white hover:bg-slate-800">
          Add Department
        </button>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editDeptCode} onChange={(e) => setEditDeptCode(e.target.value)} />
                  ) : (
                    row.deptCode
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editDeptName} onChange={(e) => setEditDeptName(e.target.value)} />
                  ) : (
                    row.deptName
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {editId === row.id ? (
                      <>
                        <button onClick={saveEdit} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
                          Save
                        </button>
                        <button onClick={cancelEdit} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(row)} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
                          Edit
                        </button>
                        <button onClick={() => removeDepartment(row.id)} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-3 py-2 text-slate-500" colSpan={3}>
                  No departments.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
