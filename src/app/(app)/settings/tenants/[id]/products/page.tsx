"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type ProductRow = {
  id: string;
  itemCode: string;
  itemName: string;
  keywords: string[] | null;
  incomeGl: string | null;
  expenseGl: string | null;
};

export default function TenantProductsPage() {
  const params = useParams<{ id: string }>();
  const tenantId = String(params?.id || "");

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [incomeGl, setIncomeGl] = useState("");
  const [expenseGl, setExpenseGl] = useState("");
  const [editId, setEditId] = useState("");
  const [editItemCode, setEditItemCode] = useState("");
  const [editItemName, setEditItemName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editIncomeGl, setEditIncomeGl] = useState("");
  const [editExpenseGl, setEditExpenseGl] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!tenantId) return;
    const response = await fetch(`/api/tenants/${tenantId}/products`);
    const json = (await response.json()) as { success: boolean; data?: ProductRow[]; error?: string };
    if (json.success) setRows(json.data || []);
    else setMessage(json.error || "Failed to load products");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function createProduct() {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemCode,
        itemName,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        incomeGl: incomeGl || undefined,
        expenseGl: expenseGl || undefined,
      }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Product created" : json.error || "Create failed");
    if (json.success) {
      setItemCode("");
      setItemName("");
      setKeywords("");
      setIncomeGl("");
      setExpenseGl("");
      await load();
    }
  }

  async function removeProduct(id: string) {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/products`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Product removed" : json.error || "Remove failed");
    if (json.success) await load();
  }

  function startEdit(row: ProductRow) {
    setEditId(row.id);
    setEditItemCode(row.itemCode);
    setEditItemName(row.itemName);
    setEditKeywords((row.keywords || []).join(", "));
    setEditIncomeGl(row.incomeGl || "");
    setEditExpenseGl(row.expenseGl || "");
  }

  function cancelEdit() {
    setEditId("");
    setEditItemCode("");
    setEditItemName("");
    setEditKeywords("");
    setEditIncomeGl("");
    setEditExpenseGl("");
  }

  async function saveEdit() {
    if (!editId) return;
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantId}/products`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editId,
        itemCode: editItemCode,
        itemName: editItemName,
        keywords: editKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        incomeGl: editIncomeGl || undefined,
        expenseGl: editExpenseGl || undefined,
      }),
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    setMessage(json.success ? "Product updated" : json.error || "Update failed");
    if (json.success) {
      cancelEdit();
      await load();
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Products</h1>
      <p className="text-slate-600">Create and manage product/item master data for this tenant.</p>

      <div className="grid gap-2 rounded border bg-white p-3 text-sm sm:grid-cols-2">
        <input className="rounded border px-2 py-1" placeholder="Item code" value={itemCode} onChange={(e) => setItemCode(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
        <input
          className="rounded border px-2 py-1"
          placeholder="Keywords (comma separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <input className="rounded border px-2 py-1" placeholder="Income GL (optional)" value={incomeGl} onChange={(e) => setIncomeGl(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Expense GL (optional)" value={expenseGl} onChange={(e) => setExpenseGl(e.target.value)} />
        <button onClick={createProduct} className="rounded bg-slate-900 px-3 py-2 text-white hover:bg-slate-800">
          Add Product
        </button>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Keywords</th>
              <th className="px-3 py-2">Income GL</th>
              <th className="px-3 py-2">Expense GL</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editItemCode} onChange={(e) => setEditItemCode(e.target.value)} />
                  ) : (
                    row.itemCode
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editItemName} onChange={(e) => setEditItemName(e.target.value)} />
                  ) : (
                    row.itemName
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} />
                  ) : (
                    (row.keywords || []).join(", ") || "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editIncomeGl} onChange={(e) => setEditIncomeGl(e.target.value)} />
                  ) : (
                    row.incomeGl || "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  {editId === row.id ? (
                    <input className="w-full rounded border px-2 py-1" value={editExpenseGl} onChange={(e) => setEditExpenseGl(e.target.value)} />
                  ) : (
                    row.expenseGl || "-"
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
                        <button onClick={() => removeProduct(row.id)} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
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
                  No products.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

