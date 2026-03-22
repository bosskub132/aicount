"use client";

import { useEffect, useState } from "react";

type VendorRow = {
  id: string;
  taxId: string;
  name: string;
  address: string | null;
  defaultExpenseGl: string | null;
  defaultWhtRate: string | null;
};

export default function MasterDataVendorsPage() {
  const [tenantId, setTenantId] = useState("");

  const [rows, setRows] = useState<VendorRow[]>([]);
  const [taxId, setTaxId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [defaultExpenseGl, setDefaultExpenseGl] = useState("");
  const [defaultWhtRate, setDefaultWhtRate] = useState("3");
  const [editId, setEditId] = useState("");
  const [editTaxId, setEditTaxId] = useState("");
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDefaultExpenseGl, setEditDefaultExpenseGl] = useState("");
  const [editDefaultWhtRate, setEditDefaultWhtRate] = useState("3");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(id);
  }, []);

  async function load() {
    if (!tenantId) return;
    const response = await fetch(`/api/tenants/${tenantId}/vendors`, {
      headers: { "x-tenant-id": tenantId },
    });
    const json = (await response.json()) as { success: boolean; data?: VendorRow[]; error?: string };
    if (json.success) setRows(json.data || []);
    else setMessage(json.error || "Failed to load vendors");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function createVendor() {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/vendors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({
        taxId,
        name,
        address: address || undefined,
        defaultExpenseGl: defaultExpenseGl || undefined,
        defaultWhtRate: Number(defaultWhtRate),
      }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Vendor created" : json.error || "Create failed");
    if (json.success) {
      setTaxId("");
      setName("");
      setAddress("");
      setDefaultExpenseGl("");
      setDefaultWhtRate("3");
      await load();
    }
  }

  async function removeVendor(id: string) {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/vendors`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Vendor removed" : json.error || "Remove failed");
    if (json.success) await load();
  }

  function startEdit(row: VendorRow) {
    setEditId(row.id);
    setEditTaxId(row.taxId);
    setEditName(row.name);
    setEditAddress(row.address || "");
    setEditDefaultExpenseGl(row.defaultExpenseGl || "");
    setEditDefaultWhtRate(row.defaultWhtRate || "3");
  }

  function cancelEdit() {
    setEditId("");
    setEditTaxId("");
    setEditName("");
    setEditAddress("");
    setEditDefaultExpenseGl("");
    setEditDefaultWhtRate("3");
  }

  async function saveEdit() {
    if (!editId) return;
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/vendors`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({
        id: editId,
        taxId: editTaxId,
        name: editName,
        address: editAddress || undefined,
        defaultExpenseGl: editDefaultExpenseGl || undefined,
        defaultWhtRate: Number(editDefaultWhtRate),
      }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Vendor updated" : json.error || "Update failed");
    if (json.success) {
      cancelEdit();
      await load();
    }
  }

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <p className="text-slate-500">No workspace selected. Please select a workspace to manage vendors.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Vendors</h1>
      <p className="text-slate-600">Create and manage vendor master data for this tenant.</p>

      <div className="grid gap-2 rounded border bg-white p-3 text-sm sm:grid-cols-2">
        <input className="rounded border px-2 py-1" placeholder="Tax ID" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Vendor name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Default expense GL (optional)" value={defaultExpenseGl} onChange={(e) => setDefaultExpenseGl(e.target.value)} />
        <input
          className="rounded border px-2 py-1"
          placeholder="Default WHT rate"
          value={defaultWhtRate}
          onChange={(e) => setDefaultWhtRate(e.target.value)}
        />
        <button onClick={createVendor} className="rounded bg-slate-900 px-3 py-2 text-white hover:bg-slate-800">
          Add Vendor
        </button>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Tax ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">Expense GL</th>
              <th className="px-3 py-2">WHT %</th>
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
                    <input className="w-full rounded border px-2 py-1" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                  ) : (
                    row.address || "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input
                      className="w-full rounded border px-2 py-1"
                      value={editDefaultExpenseGl}
                      onChange={(e) => setEditDefaultExpenseGl(e.target.value)}
                    />
                  ) : (
                    row.defaultExpenseGl || "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input
                      className="w-24 rounded border px-2 py-1"
                      value={editDefaultWhtRate}
                      onChange={(e) => setEditDefaultWhtRate(e.target.value)}
                    />
                  ) : (
                    row.defaultWhtRate || "-"
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
                        <button onClick={() => removeVendor(row.id)} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
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
                <td className="px-3 py-2 text-slate-500" colSpan={6}>
                  No vendors.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
