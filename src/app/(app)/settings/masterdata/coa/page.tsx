"use client";

import { useEffect, useState } from "react";

type CoaCategory = "asset" | "liability" | "equity" | "revenue" | "expense";
type CoaRow = {
  id: string;
  accountCode: string;
  accountName: string;
  category: CoaCategory;
  isSuspense: boolean;
};

export default function MasterDataCoaPage() {
  const [tenantId, setTenantId] = useState("");

  const [rows, setRows] = useState<CoaRow[]>([]);
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [category, setCategory] = useState<CoaCategory>("expense");
  const [isSuspense, setIsSuspense] = useState(false);
  const [editId, setEditId] = useState("");
  const [editAccountCode, setEditAccountCode] = useState("");
  const [editAccountName, setEditAccountName] = useState("");
  const [editCategory, setEditCategory] = useState<CoaCategory>("expense");
  const [editIsSuspense, setEditIsSuspense] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  async function load() {
    if (!tenantId) return;
    const response = await fetch(`/api/tenants/${tenantId}/coa`, {
      headers: { "x-tenant-id": tenantId },
    });
    const json = (await response.json()) as { success: boolean; data?: CoaRow[]; error?: string };
    if (json.success) setRows(json.data || []);
    else setMessage(json.error || "Failed to load COA");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function createAccount() {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/coa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ accountCode, accountName, category, isSuspense }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Account created" : json.error || "Create failed");
    if (json.success) {
      setAccountCode("");
      setAccountName("");
      setCategory("expense");
      setIsSuspense(false);
      await load();
    }
  }

  async function removeAccount(id: string) {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/coa`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Account removed" : json.error || "Remove failed");
    if (json.success) await load();
  }

  function startEdit(row: CoaRow) {
    setEditId(row.id);
    setEditAccountCode(row.accountCode);
    setEditAccountName(row.accountName);
    setEditCategory(row.category);
    setEditIsSuspense(Boolean(row.isSuspense));
  }

  function cancelEdit() {
    setEditId("");
    setEditAccountCode("");
    setEditAccountName("");
    setEditCategory("expense");
    setEditIsSuspense(false);
  }

  async function saveEdit() {
    if (!editId) return;
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/coa`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({
        id: editId,
        accountName: editAccountName,
        category: editCategory,
        isSuspense: editIsSuspense,
      }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Account updated" : json.error || "Update failed");
    if (json.success) {
      cancelEdit();
      await load();
    }
  }

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
        <p className="text-slate-500">No workspace selected. Please select a workspace to manage chart of accounts.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
      <p className="text-slate-600">Create and manage account master data for this tenant.</p>

      <div className="grid gap-2 rounded border bg-white p-3 text-sm sm:grid-cols-2">
        <input
          className="rounded border px-2 py-1"
          placeholder="Account code"
          value={accountCode}
          onChange={(e) => setAccountCode(e.target.value)}
        />
        <input
          className="rounded border px-2 py-1"
          placeholder="Account name"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
        />
        <select className="rounded border px-2 py-1" value={category} onChange={(e) => setCategory(e.target.value as CoaCategory)}>
          <option value="asset">asset</option>
          <option value="liability">liability</option>
          <option value="equity">equity</option>
          <option value="revenue">revenue</option>
          <option value="expense">expense</option>
        </select>
        <label className="flex items-center gap-2 rounded border px-2 py-1">
          <input type="checkbox" checked={isSuspense} onChange={(e) => setIsSuspense(e.target.checked)} />
          Suspense account
        </label>
        <button onClick={createAccount} className="rounded bg-slate-900 px-3 py-2 text-white hover:bg-slate-800">
          Add Account
        </button>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Suspense</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{editId === row.id ? editAccountCode : row.accountCode}</td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input
                      className="w-full rounded border px-2 py-1"
                      value={editAccountName}
                      onChange={(e) => setEditAccountName(e.target.value)}
                    />
                  ) : (
                    row.accountName
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <select
                      className="rounded border px-2 py-1"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as CoaCategory)}
                    >
                      <option value="asset">asset</option>
                      <option value="liability">liability</option>
                      <option value="equity">equity</option>
                      <option value="revenue">revenue</option>
                      <option value="expense">expense</option>
                    </select>
                  ) : (
                    row.category
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={editIsSuspense} onChange={(e) => setEditIsSuspense(e.target.checked)} />
                      Yes
                    </label>
                  ) : row.isSuspense ? (
                    "Yes"
                  ) : (
                    "No"
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
                        <button onClick={() => removeAccount(row.id)} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
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
                <td className="px-3 py-2 text-slate-500" colSpan={5}>
                  No accounts.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
