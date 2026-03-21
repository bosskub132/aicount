/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type TenantSummary = {
  assignmentId: string;
  role: string;
  tenantId: string;
  tenantName: string;
  taxId: string;
};

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isOnboardingComplete: boolean;
};

export default function SettingsPage() {
  const [tenantId, setTenantId] = useState("00000000-0000-0000-0000-000000000000");

  useEffect(() => {
    setTenantId(getWorkspaceTenantId());
  }, []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceTaxId, setWorkspaceTaxId] = useState("");
  const [creating, setCreating] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<"single" | "multi">("multi");

  const defaultTenantId = "00000000-0000-0000-0000-000000000000";
  const hasWorkspace = tenantId !== defaultTenantId;
  const base = `/settings/tenants/${tenantId}`;

  const pages = [
    { label: "Chart of Accounts", href: `${base}/coa` },
    { label: "Vendors", href: `${base}/vendors` },
    { label: "Customers", href: `${base}/customers` },
    { label: "Products", href: `${base}/products` },
    { label: "Departments", href: `${base}/departments` },
    { label: "Templates", href: `${base}/templates` },
    { label: "Assignments", href: `${base}/assignments` },
    { label: "Period Locks", href: `${base}/period-locks` },
  ];

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/profile").then((r) => r.json()),
      fetch("/api/tenants").then((r) => r.json()),
    ]).then(([profileJson, tenantsJson]) => {
      if (profileJson.success && profileJson.data) {
        setProfile(profileJson.data);
        setProfileName(profileJson.data.name || "");
      }
      if (tenantsJson.success) setTenants(tenantsJson.data || []);
    });
  }, []);

  async function saveProfile() {
    setMessage("");
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: profileName }),
    });
    const json = await res.json();
    setMessage(json.success ? "Profile updated" : json.error || "Update failed");
  }

  async function createWorkspace() {
    setMessage(""); setCreating(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName, taxId: workspaceTaxId }),
      });
      const json = await res.json();
      if (!json.success) { setMessage(json.error || "Create failed"); return; }
      localStorage.setItem("workspaceTenantId", json.data.id);
      setTenantId(json.data.id);
      setWorkspaceName(""); setWorkspaceTaxId("");
      setMessage(`Workspace "${json.data.name}" created`);
      const tenantRes = await fetch("/api/tenants").then((r) => r.json());
      if (tenantRes.success) setTenants(tenantRes.data || []);
    } catch (err: any) {
      setMessage(err.message || "Failed");
    } finally { setCreating(false); }
  }

  function switchWorkspace(id: string) {
    localStorage.setItem("workspaceTenantId", id);
    setTenantId(id);
    window.location.reload();
  }

  async function restartOnboarding() {
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOnboardingComplete: false }),
    });
    window.location.reload();
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">&larr; Back to Dashboard</Link>
      </div>

      <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>

      {/* Profile Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-800">Profile</h2>
        <p className="text-xs text-slate-500">Manage your personal information</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-blue-700">Email</label>
            <input
              className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-600"
              value={profile?.email || ""}
              disabled
            />
            <p className="mt-0.5 text-[10px] text-slate-400">Email cannot be changed</p>
          </div>
          <div>
            <label className="text-xs font-medium text-blue-700">Full Name</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <button
            onClick={saveProfile}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700"
          >
            Save Profile
          </button>
        </div>
      </div>

      {/* Workspace Mode */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-800">Workspace Mode</h2>
        <p className="text-xs text-slate-500">Choose how you want to manage your transactions</p>
        <div className="mt-4 space-y-2">
          <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${workspaceMode === "single" ? "border-blue-400 bg-blue-50" : ""}`}>
            <input type="radio" name="mode" value="single" checked={workspaceMode === "single"} onChange={() => setWorkspaceMode("single")} />
            <div>
              <p className="text-sm font-medium">Single Business</p>
              <p className="text-xs text-slate-500">Manage transactions for one business</p>
            </div>
          </label>
          <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${workspaceMode === "multi" ? "border-blue-400 bg-blue-50" : ""}`}>
            <input type="radio" name="mode" value="multi" checked={workspaceMode === "multi"} onChange={() => setWorkspaceMode("multi")} />
            <div>
              <p className="text-sm font-medium">Multiple Clients</p>
              <p className="text-xs text-slate-500">Manage transactions for multiple clients (accountant mode)</p>
            </div>
          </label>
        </div>
        <button
          onClick={restartOnboarding}
          className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
        >
          Restart Onboarding Wizard
        </button>
        <p className="mt-1 text-[10px] text-slate-400">Walk through the workspace setup again</p>
      </div>

      {/* Create Workspace */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-800">Business Profile</h2>
        <p className="text-xs text-slate-500">Create and manage your company workspaces</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Company name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
          />
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Tax ID (13 digits)"
            maxLength={13}
            value={workspaceTaxId}
            onChange={(e) => setWorkspaceTaxId(e.target.value)}
          />
        </div>
        <button
          onClick={createWorkspace}
          disabled={creating || !workspaceName || !workspaceTaxId}
          className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          {creating ? "Creating..." : "+ Create Workspace"}
        </button>
      </div>

      {/* My Workspaces */}
      {tenants.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-800">My Workspaces</h2>
          <div className="mt-3 space-y-2">
            {tenants.map((t) => (
              <div key={t.assignmentId} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.tenantName}</p>
                  <p className="text-[10px] text-slate-400">{t.taxId} &middot; {t.role}</p>
                </div>
                <button
                  onClick={() => switchWorkspace(t.tenantId)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    t.tenantId === tenantId
                      ? "bg-blue-50 text-blue-700"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.tenantId === tenantId ? "Active" : "Switch"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && <p className="text-sm text-slate-600">{message}</p>}

      {/* Tenant Config Pages */}
      {hasWorkspace && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-800">Tenant Configuration</h2>
          <p className="text-xs text-slate-500">Manage master data and settings for the active workspace</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {pages.map((page) => (
              <Link
                key={page.label}
                href={page.href}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {page.label}
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
