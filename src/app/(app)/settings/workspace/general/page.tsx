"use client";

import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type TenantData = {
  id: string;
  name: string;
  taxId: string | null;
  vatRegistered: boolean;
  baseCurrency: string;
  dataRetentionYears: number;
  industry: string | null;
  companySize: string | null;
};

export default function WorkspaceGeneralPage() {
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("THB");
  const [dataRetentionYears, setDataRetentionYears] = useState(5);
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");

  useEffect(() => {
    const id = getWorkspaceTenantId();
    setTenantId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    async function fetchTenant() {
      try {
        const response = await fetch(`/api/tenants/${id}`);
        const json = (await response.json()) as { success: boolean; data?: TenantData; error?: string };
        if (json.success && json.data) {
          const d = json.data;
          setName(d.name);
          setTaxId(d.taxId ?? "");
          setVatRegistered(d.vatRegistered);
          setBaseCurrency(d.baseCurrency ?? "THB");
          setDataRetentionYears(d.dataRetentionYears ?? 5);
          setIndustry(d.industry ?? "");
          setCompanySize(d.companySize ?? "");
        } else {
          setError(json.error ?? "Failed to load workspace");
        }
      } catch {
        setError("Failed to load workspace");
      } finally {
        setLoading(false);
      }
    }

    void fetchTenant();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, taxId, vatRegistered, baseCurrency, dataRetentionYears, industry: industry || undefined, companySize: companySize || undefined }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(json.error ?? "Failed to save workspace settings");
      }
    } catch {
      setError("Failed to save workspace settings");
    } finally {
      setSaving(false);
    }
  }

  if (!tenantId && !loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-slate-500" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Workspace Settings</h1>
            <p className="text-sm text-slate-500">Manage your workspace configuration.</p>
          </div>
        </div>
        <div className="flex max-w-lg flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Building2 className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No workspace selected</p>
          <p className="mt-1 text-xs text-slate-400">Select a workspace to manage its settings.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-slate-500" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workspace Settings</h1>
          <p className="text-sm text-slate-500">Manage your workspace configuration.</p>
        </div>
      </div>

      <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="workspace-name">
                Name
              </label>
              <input
                id="workspace-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Workspace name"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="tax-id">
                Tax ID
              </label>
              <input
                id="tax-id"
                type="text"
                value={taxId}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 13);
                  setTaxId(v);
                }}
                placeholder="13-digit tax ID"
                maxLength={13}
                pattern="\d{13}"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400">Must be exactly 13 numeric digits.</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="vat-registered"
                type="checkbox"
                checked={vatRegistered}
                onChange={(e) => setVatRegistered(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="text-sm font-medium text-slate-700" htmlFor="vat-registered">
                VAT Registered
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="base-currency">
                Base Currency
              </label>
              <input
                id="base-currency"
                type="text"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
                placeholder="THB"
                maxLength={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="data-retention">
                Data Retention (Years)
              </label>
              <input
                id="data-retention"
                type="number"
                value={dataRetentionYears}
                onChange={(e) => setDataRetentionYears(Number(e.target.value))}
                min={1}
                max={30}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="industry">
                ประเภทธุรกิจ (Industry)
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select industry</option>
                <option value="retail">ค้าปลีก (Retail)</option>
                <option value="manufacturing">การผลิต (Manufacturing)</option>
                <option value="services">บริการ (Services)</option>
                <option value="construction">ก่อสร้าง (Construction)</option>
                <option value="hospitality">โรงแรม/ร้านอาหาร (Hospitality)</option>
                <option value="healthcare">สุขภาพ (Healthcare)</option>
                <option value="education">การศึกษา (Education)</option>
                <option value="technology">เทคโนโลยี (Technology)</option>
                <option value="other">อื่นๆ (Other)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                ขนาดบริษัท (Company Size)
              </label>
              <div className="flex flex-col gap-2">
                {[
                  { value: "micro", label: "Micro (1-5 คน)" },
                  { value: "small", label: "Small (6-30 คน)" },
                  { value: "medium", label: "Medium (31-200 คน)" },
                  { value: "large", label: "Large (200+ คน)" },
                ].map((option) => (
                  <label key={option.value} className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="companySize"
                      value={option.value}
                      checked={companySize === option.value}
                      onChange={(e) => setCompanySize(e.target.value)}
                      className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {saved ? <p className="text-sm text-green-600">Settings saved!</p> : null}

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
        )}
      </div>

      <DefaultWorkspaceSection tenantId={tenantId} />
    </section>
  );
}

function DefaultWorkspaceSection({ tenantId }: { tenantId: string }) {
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    fetch("/api/tenants", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j: { data?: Array<{ tenantId: string; isDefault: boolean }> }) => {
        const found = (j.data ?? []).find((t) => t.tenantId === tenantId);
        setIsDefault(!!found?.isDefault);
      })
      .catch(() => setIsDefault(false));
  }, [tenantId]);

  async function handleSet() {
    if (!tenantId || isDefault) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile/default-workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (res.ok) {
      setIsDefault(true);
      setMsg("Saved");
    } else {
      setMsg("Failed — try again");
    }
    setBusy(false);
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">Default Workspace</h2>
      <p className="mt-1 text-sm text-slate-600">
        The default workspace loads automatically when you sign in on a new device or after clearing
        cookies.
      </p>
      <div className="mt-4 flex items-center gap-3">
        {isDefault === null ? (
          <span className="text-sm text-slate-500">Loading…</span>
        ) : isDefault ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            ★ Default workspace
          </span>
        ) : (
          <button
            type="button"
            onClick={handleSet}
            disabled={busy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Set as default"}
          </button>
        )}
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
