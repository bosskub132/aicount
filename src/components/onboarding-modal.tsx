/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";

const STEPS = [
  { title: "Create Workspace", description: "Set up your company workspace" },
  { title: "Chart of Accounts", description: "Import your account codes" },
  { title: "Departments", description: "Add cost centers / departments" },
  { title: "Assign Roles", description: "Invite team members" },
  { title: "Export Template", description: "Configure export settings" },
];

type OnboardingModalProps = {
  onComplete: () => void;
};

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [tenantId, setTenantId] = useState("");
  const [message, setMessage] = useState("");

  // Step 1: Create Tenant
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [creating, setCreating] = useState(false);

  // Step 2: COA
  const [coaRows, setCoaRows] = useState<{ accountCode: string; accountName: string; category: string }[]>([]);
  const [coaCode, setCoaCode] = useState("");
  const [coaName, setCoaName] = useState("");
  const [coaCategory, setCoaCategory] = useState("expense");

  // Step 3: Departments
  const [depts, setDepts] = useState<{ deptCode: string; deptName: string }[]>([]);
  const [deptCode, setDeptCode] = useState("");
  const [deptName, setDeptName] = useState("");

  // Step 4: Invitations
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"maker" | "checker">("maker");
  const [invitations, setInvitations] = useState<any[]>([]);

  // Step 5: Template
  const [templateChoice, setTemplateChoice] = useState("default");

  const loadExistingData = useCallback(async (tid: string) => {
    const [coaRes, deptRes] = await Promise.all([
      fetch(`/api/tenants/${tid}/coa`).then((r) => r.json()),
      fetch(`/api/tenants/${tid}/departments`).then((r) => r.json()),
    ]);
    if (coaRes.success) setCoaRows(coaRes.data || []);
    if (deptRes.success) setDepts(deptRes.data || []);
  }, []);

  useEffect(() => {
    // Check if user already has a tenant
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          const first = json.data[0];
          setTenantId(first.tenantId);
          localStorage.setItem("workspaceTenantId", first.tenantId);
          setCompanyName(first.tenantName);
          setTaxId(first.taxId);
          loadExistingData(first.tenantId);
        }
      });
  }, [loadExistingData]);

  async function createTenant() {
    if (!companyName || !taxId) { setMessage("Company name and Tax ID required"); return; }
    setCreating(true);
    setMessage("");
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName, taxId }),
      });
      const json = await res.json();
      if (!json.success) { setMessage(json.error || "Failed"); return; }
      setTenantId(json.data.id);
      localStorage.setItem("workspaceTenantId", json.data.id);
      setMessage("Workspace created!");
    } catch (err: any) {
      setMessage(err.message || "Error");
    } finally {
      setCreating(false);
    }
  }

  async function addCoaEntry() {
    if (!coaCode || !coaName || !tenantId) return;
    setMessage("");
    const res = await fetch(`/api/tenants/${tenantId}/coa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountCode: coaCode, accountName: coaName, category: coaCategory }),
    });
    const json = await res.json();
    if (json.success) {
      setCoaRows((prev) => [...prev, { accountCode: coaCode, accountName: coaName, category: coaCategory }]);
      setCoaCode("");
      setCoaName("");
    } else {
      setMessage(json.error || "Failed to add");
    }
  }

  async function addDepartment() {
    if (!deptCode || !deptName || !tenantId) return;
    setMessage("");
    const res = await fetch(`/api/tenants/${tenantId}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deptCode, deptName }),
    });
    const json = await res.json();
    if (json.success) {
      setDepts((prev) => [...prev, { deptCode, deptName }]);
      setDeptCode("");
      setDeptName("");
    } else {
      setMessage(json.error || "Failed to add");
    }
  }

  async function sendInvite() {
    if (!inviteEmail || !tenantId) return;
    setMessage("");
    const res = await fetch(`/api/tenants/${tenantId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const json = await res.json();
    if (json.success) {
      setInvitations((prev) => [...prev, { email: inviteEmail, role: inviteRole }]);
      setInviteEmail("");
      setMessage("Invitation sent!");
    } else {
      setMessage(json.error || "Failed to invite");
    }
  }

  async function completeOnboarding() {
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOnboardingComplete: true }),
    });
    onComplete();
  }

  function canAdvance(): boolean {
    if (step === 0) return !!tenantId;
    return true;
  }

  function handleNext() {
    setMessage("");
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Progress bar */}
        <div className="px-6 pt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>

        {/* Header */}
        <div className="px-6 pt-3 pb-2">
          <h2 className="text-lg font-semibold text-slate-900">{STEPS[step].title}</h2>
          <p className="text-sm text-slate-500">{STEPS[step].description}</p>
        </div>

        {/* Content */}
        <div className="min-h-[280px] px-6 py-3">
          {step === 0 && (
            <div className="space-y-3">
              {tenantId ? (
                <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Workspace ready: <strong>{companyName}</strong>
                </div>
              ) : (
                <>
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Company name *"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Tax ID (13 digits) *"
                    maxLength={13}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                  <button
                    onClick={createTenant}
                    disabled={creating || !companyName || !taxId}
                    className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                  >
                    {creating ? "Creating..." : "Create Workspace"}
                  </button>
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  className="w-24 rounded border px-2 py-1.5 text-sm"
                  placeholder="Code"
                  value={coaCode}
                  onChange={(e) => setCoaCode(e.target.value)}
                />
                <input
                  className="flex-1 rounded border px-2 py-1.5 text-sm"
                  placeholder="Account name"
                  value={coaName}
                  onChange={(e) => setCoaName(e.target.value)}
                />
                <select
                  className="rounded border px-2 py-1.5 text-sm"
                  value={coaCategory}
                  onChange={(e) => setCoaCategory(e.target.value)}
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
                <button onClick={addCoaEntry} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Add
                </button>
              </div>
              <div className="max-h-44 overflow-auto rounded border">
                {coaRows.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        <th className="px-2 py-1">Code</th>
                        <th className="px-2 py-1">Name</th>
                        <th className="px-2 py-1">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coaRows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{r.accountCode}</td>
                          <td className="px-2 py-1">{r.accountName}</td>
                          <td className="px-2 py-1">{r.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-3 py-4 text-center text-xs text-slate-400">No accounts added yet. You can add them later in Settings.</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  className="w-28 rounded border px-2 py-1.5 text-sm"
                  placeholder="Dept code"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                />
                <input
                  className="flex-1 rounded border px-2 py-1.5 text-sm"
                  placeholder="Department name"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                />
                <button onClick={addDepartment} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Add
                </button>
              </div>
              <div className="max-h-44 overflow-auto rounded border">
                {depts.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        <th className="px-2 py-1">Code</th>
                        <th className="px-2 py-1">Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depts.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{d.deptCode}</td>
                          <td className="px-2 py-1">{d.deptName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-3 py-4 text-center text-xs text-slate-400">No departments added yet. You can add them later in Settings.</p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                As workspace creator, you already have both maker and checker roles.
                Invite others to collaborate.
              </p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border px-2 py-1.5 text-sm"
                  placeholder="Email address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <select
                  className="rounded border px-2 py-1.5 text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "maker" | "checker")}
                >
                  <option value="maker">Maker</option>
                  <option value="checker">Checker</option>
                </select>
                <button onClick={sendInvite} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Invite
                </button>
              </div>
              {invitations.length > 0 && (
                <div className="rounded border">
                  {invitations.map((inv, i) => (
                    <div key={i} className="flex items-center justify-between border-b px-3 py-2 text-xs last:border-b-0">
                      <span>{inv.email}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">{inv.role}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400">
                Invited users will receive an email. If they haven&apos;t registered, they&apos;ll be guided to sign up first.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Choose an export template for Express accounting software, or skip to use the default.
              </p>
              <label className="flex items-center gap-3 rounded border p-3 cursor-pointer">
                <input
                  type="radio"
                  name="template"
                  value="default"
                  checked={templateChoice === "default"}
                  onChange={() => setTemplateChoice("default")}
                />
                <div>
                  <p className="text-sm font-medium">Default Template</p>
                  <p className="text-xs text-slate-500">Standard Express format with common journal types</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded border p-3 cursor-pointer">
                <input
                  type="radio"
                  name="template"
                  value="custom"
                  checked={templateChoice === "custom"}
                  onChange={() => setTemplateChoice("custom")}
                />
                <div>
                  <p className="text-sm font-medium">Custom Template</p>
                  <p className="text-xs text-slate-500">Configure custom mappings later in Settings</p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          {message && <p className="text-xs text-slate-600">{message}</p>}
          <div className="ml-auto flex gap-2">
            {step > 0 && (
              <button
                onClick={() => { setStep(step - 1); setMessage(""); }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canAdvance()}
                className="rounded bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="rounded bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-600"
              >
                Complete Setup
              </button>
            )}
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 pb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? "w-6 bg-indigo-500" : i < step ? "w-2 bg-indigo-300" : "w-2 bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
