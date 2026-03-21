"use client";

import { useEffect, useState } from "react";

export const DEFAULT_WORKSPACE_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export function isDefaultWorkspaceTenantId(id: string | null | undefined) {
  return !id || id === DEFAULT_WORKSPACE_TENANT_ID;
}

type Workspace = {
  tenantId: string;
  tenantName: string;
  taxId: string;
  role: string;
};

export function getWorkspaceTenantId() {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_TENANT_ID;
  return localStorage.getItem("workspaceTenantId") || DEFAULT_WORKSPACE_TENANT_ID;
}

export function WorkspaceSelector() {
  const [tenantId, setTenantId] = useState(() => getWorkspaceTenantId());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadWorkspaces() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/tenants", { credentials: "same-origin" });
      const json = (await res.json()) as { success?: boolean; error?: string; data?: Workspace[] };
      if (!res.ok) {
        setLoadError(`Could not load workspaces (${res.status}). Try again or sign in again.`);
        setWorkspaces([]);
        return;
      }
      if (!json.success) {
        setLoadError(json.error || "Could not load workspaces.");
        setWorkspaces([]);
        return;
      }
      setWorkspaces(json.data || []);
    } catch {
      setLoadError("Network error loading workspaces. Check your connection and retry.");
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  function selectWorkspace(id: string) {
    localStorage.setItem("workspaceTenantId", id);
    setTenantId(id);
    setOpen(false);
    window.location.reload();
  }

  const current = workspaces.find((w) => w.tenantId === tenantId);
  const unsetClient = isDefaultWorkspaceTenantId(tenantId) && workspaces.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={loadError || undefined}
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 ${
          loadError
            ? "border-red-300"
            : unsetClient
              ? "border-amber-400 ring-1 ring-amber-200"
              : "border-slate-200"
        }`}
      >
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className="max-w-[180px] truncate">
          {loadError
            ? "Workspace load failed"
            : current
              ? current.tenantName
              : unsetClient
                ? "Select client"
                : "Select Client"}
        </span>
        <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-white py-1 shadow-lg">
            {loading && <p className="px-3 py-2 text-xs text-slate-500">Loading workspaces…</p>}
            {!loading && loadError && (
              <div className="space-y-2 px-3 py-2">
                <p className="text-xs text-red-700">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void loadWorkspaces()}
                  className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && !loadError && workspaces.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-500">
                No workspaces yet. Create a client in Settings or ask an admin to invite you.
              </p>
            )}
            {!loading &&
              !loadError &&
              workspaces.map((w) => (
                <button
                  key={w.tenantId}
                  type="button"
                  onClick={() => selectWorkspace(w.tenantId)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                    w.tenantId === tenantId ? "bg-slate-50 font-medium" : ""
                  }`}
                >
                  <div className="h-6 w-6 flex-shrink-0 rounded bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600">
                    {w.tenantName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-slate-800">{w.tenantName}</p>
                    <p className="truncate text-slate-400">{w.taxId}</p>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
