"use client";

import { useEffect, useState } from "react";

type CustomerRow = {
  id: string;
  taxId: string;
  name: string;
  creditTermDays: number | null;
};

export default function MasterDataCustomersPage() {
  const [tenantId, setTenantId] = useState("");

  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [taxId, setTaxId] = useState("");
  const [name, setName] = useState("");
  const [creditTermDays, setCreditTermDays] = useState("30");
  const [editId, setEditId] = useState("");
  const [editTaxId, setEditTaxId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCreditTermDays, setEditCreditTermDays] = useState("30");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  async function load() {
    if (!tenantId) return;
    const response = await fetch(`/api/tenants/${tenantId}/customers`, {
      headers: { "x-tenant-id": tenantId },
    });
    const json = (await response.json()) as { success: boolean; data?: CustomerRow[]; error?: string };
    if (json.success) setRows(json.data || []);
    else setMessage(json.error || "Failed to load customers");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function createCustomer() {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ taxId, name, creditTermDays: Number(creditTermDays) }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Customer created" : json.error || "Create failed");
    if (json.success) {
      setTaxId("");
      setName("");
      setCreditTermDays("30");
      await load();
    }
  }

  async function removeCustomer(id: string) {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/customers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Customer removed" : json.error || "Remove failed");
    if (json.success) await load();
  }

  function startEdit(row: CustomerRow) {
    setEditId(row.id);
    setEditTaxId(row.taxId);
    setEditName(row.name);
    setEditCreditTermDays(String(row.creditTermDays ?? 30));
  }

  function cancelEdit() {
    setEditId("");
    setEditTaxId("");
    setEditName("");
    setEditCreditTermDays("30");
  }

  async function saveEdit() {
    if (!editId) return;
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/customers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({
        id: editId,
        taxId: editTaxId,
        name: editName,
        creditTermDays: Number(editCreditTermDays),
      }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Customer updated" : json.error || "Update failed");
    if (json.success) {
      cancelEdit();
      await load();
    }
  }

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-slate-500">No workspace selected. Please select a workspace to manage customers.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <p className="text-slate-600">Create and manage customer master data for this tenant.</p>

      <div className="grid gap-2 rounded border bg-white p-3 text-sm sm:grid-cols-2">
        <input className="rounded border px-2 py-1" placeholder="Tax ID" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="rounded border px-2 py-1"
          placeholder="Credit term days"
          value={creditTermDays}
          onChange={(e) => setCreditTermDays(e.target.value)}
        />
        <button onClick={createCustomer} className="rounded bg-slate-900 px-3 py-2 text-white hover:bg-slate-800">
          Add Customer
        </button>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Tax ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Credit Days</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editTaxId} onChange={(e) => setEditTaxId(e.target.value)} />
                  ) : (
                    row.taxId
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    row.name
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input
                      className="w-24 rounded border px-2 py-1"
                      value={editCreditTermDays}
                      onChange={(e) => setEditCreditTermDays(e.target.value)}
                    />
                  ) : (
                    row.creditTermDays ?? "-"
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
                        <button onClick={() => removeCustomer(row.id)} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
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
                <td className="px-3 py-2 text-slate-500" colSpan={4}>
                  No customers.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
