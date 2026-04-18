"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown } from "lucide-react";

type Workspace = {
  tenantId: string;
  tenantName: string;
  taxId: string;
  role: string;
};

export function getWorkspaceTenantId() {
  if (typeof window === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)workspaceTenantIdPublic=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function WorkspaceSelector() {
  const [tenantId, setTenantId] = useState(() => getWorkspaceTenantId());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("workspaceTenantId");
    }
  }, []);

  async function selectWorkspace(id: string) {
    const res = await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: id }),
    });
    if (!res.ok) {
      setLoadError("Failed to switch workspace. Please try again.");
      return;
    }
    setTenantId(id);
    setOpen(false);
    queryClient.clear();
    router.refresh();
  }

  const current = workspaces.find((w) => w.tenantId === tenantId);
  const unsetClient = !tenantId && workspaces.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={loadError || undefined}
        className={`flex w-full items-center gap-2 rounded-[var(--radius-input)] border bg-[var(--muted)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--border)] transition-colors cursor-pointer ${
          loadError
            ? "border-[var(--destructive)]"
            : unsetClient
              ? "border-[var(--warning)] ring-1 ring-[var(--warning-light)]"
              : "border-[var(--border)]"
        }`}
      >
        <Building2 className="h-4 w-4 text-[var(--muted-foreground)]" />
        <span className="flex-1 truncate text-left">
          {loadError
            ? "Workspace load failed"
            : current
              ? current.tenantName
              : unsetClient
                ? "Select client"
                : "Select Client"}
        </span>
        <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[var(--z-dropdown)]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-[calc(var(--z-dropdown)+1)] mt-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-md)]">
            {loading && <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">Loading workspaces…</p>}
            {!loading && loadError && (
              <div className="space-y-2 px-3 py-2">
                <p className="text-xs text-[var(--destructive)]">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void loadWorkspaces()}
                  className="rounded-[var(--radius-button)] border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && !loadError && workspaces.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
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
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--muted)] cursor-pointer ${
                    w.tenantId === tenantId ? "bg-[var(--muted)] font-medium" : ""
                  }`}
                >
                  <div className="h-6 w-6 flex-shrink-0 rounded-[var(--radius-input)] bg-[var(--primary-light)] flex items-center justify-center text-[10px] font-semibold text-[var(--primary)]">
                    {w.tenantName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[var(--foreground)]">{w.tenantName}</p>
                    <p className="truncate text-[var(--muted-foreground)]">{w.taxId}</p>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
