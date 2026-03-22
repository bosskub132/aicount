"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, AlertTriangle, ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  deletedAt?: string | null;
  deletionScheduledFor?: string | null;
};

type Tenant = {
  tenantId: string;
  tenantName: string;
  role: string;
};

type Assignment = {
  userId: string;
  name: string | null;
  email: string;
};

type WorkspaceAction = {
  tenantId: string;
  action: "transfer" | "delete";
  newOwnerId?: string;
};

type WorkspaceConfig = {
  tenantId: string;
  tenantName: string;
  members: Assignment[];
  action: "transfer" | "delete";
  newOwnerId?: string;
};

export default function DeleteAccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaceConfigs, setWorkspaceConfigs] = useState<WorkspaceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const profileRes = await fetch("/api/auth/profile");
      const profileData = await profileRes.json();
      if (!profileData.success) return;
      setProfile(profileData.data);

      const tenantsRes = await fetch("/api/tenants");
      const tenantsData = await tenantsRes.json();
      if (!tenantsData.success) return;

      const allTenants: Tenant[] = tenantsData.data ?? [];
      const ownedTenants = allTenants.filter((t) => {
        const roles = t.role.split(", ");
        return roles.includes("maker") && roles.includes("checker");
      });

      const configs: WorkspaceConfig[] = [];
      for (const t of ownedTenants) {
        const assignRes = await fetch(`/api/tenants/${t.tenantId}/assignments`);
        const assignData = await assignRes.json();
        const members: Assignment[] = (assignData.data ?? []).map((a: { userId: string; name: string | null; email: string }) => ({
          userId: a.userId,
          name: a.name,
          email: a.email,
        }));

        const uniqueMembers = members.filter(
          (m, i, arr) => arr.findIndex((x) => x.userId === m.userId) === i
        );
        const otherMembers = uniqueMembers.filter((m) => m.userId !== profileData.data.id);

        configs.push({
          tenantId: t.tenantId,
          tenantName: t.tenantName,
          members: otherMembers,
          action: otherMembers.length === 0 ? "delete" : "transfer",
          newOwnerId: otherMembers[0]?.userId,
        });
      }
      setWorkspaceConfigs(configs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateWorkspaceAction(tenantId: string, action: "transfer" | "delete", newOwnerId?: string) {
    setWorkspaceConfigs((prev) =>
      prev.map((w) =>
        w.tenantId === tenantId ? { ...w, action, newOwnerId } : w
      )
    );
  }

  async function handleConfirmDelete() {
    if (!profile || confirmEmail !== profile.email) return;
    setSubmitting(true);
    setError("");
    try {
      const workspaceActions: WorkspaceAction[] = workspaceConfigs.map((w) => ({
        tenantId: w.tenantId,
        action: w.action,
        newOwnerId: w.action === "transfer" ? w.newOwnerId : undefined,
      }));

      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceActions }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Deletion failed");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelDeletion() {
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/auth/account/cancel-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to cancel deletion");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-32 w-full max-w-lg animate-pulse rounded-lg bg-slate-100" />
      </section>
    );
  }

  // Pending deletion state
  if (profile?.deletedAt) {
    const scheduledDate = profile.deletionScheduledFor
      ? new Date(profile.deletionScheduledFor).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "soon";

    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Account Scheduled for Deletion</h1>
            <p className="text-sm text-slate-500">Your account will be permanently deleted on {scheduledDate}.</p>
          </div>
        </div>

        <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-6">
          <p className="mb-4 text-sm text-amber-800">
            Your account is scheduled for deletion on <strong>{scheduledDate}</strong>. You can cancel this before the date to restore access to your account and workspaces.
          </p>
          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
          <button
            onClick={handleCancelDeletion}
            disabled={cancelling}
            className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            <ArrowRight className="h-4 w-4" />
            {cancelling ? "Cancelling..." : "Cancel Deletion & Keep Account"}
          </button>
        </div>
      </section>
    );
  }

  const isConfirmValid = profile?.email && confirmEmail === profile.email;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Trash2 className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-2xl font-semibold text-red-700">Delete Account</h1>
          <p className="text-sm text-slate-500">Permanently remove your account and all associated data.</p>
        </div>
      </div>

      {profile ? (
        <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800">Account Information</h2>
          <div className="text-sm text-slate-700 space-y-1">
            <p><span className="font-medium">Name:</span> {profile.name ?? "—"}</p>
            <p><span className="font-medium">Email:</span> {profile.email}</p>
          </div>
        </div>
      ) : null}

      {workspaceConfigs.length > 0 ? (
        <div className="max-w-lg space-y-4">
          <h2 className="text-base font-semibold text-slate-800">Owned Workspaces</h2>
          {workspaceConfigs.map((w) => (
            <div key={w.tenantId} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <p className="font-medium text-slate-900">{w.tenantName}</p>
              {w.members.length === 0 ? (
                <p className="text-sm text-red-600 font-medium">Will be deleted (no other members)</p>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Action</label>
                  <select
                    value={w.action === "transfer" ? `transfer:${w.newOwnerId ?? ""}` : "delete"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "delete") {
                        updateWorkspaceAction(w.tenantId, "delete");
                      } else {
                        const newOwnerId = val.replace("transfer:", "");
                        updateWorkspaceAction(w.tenantId, "transfer", newOwnerId);
                      }
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {w.members.map((m) => (
                      <option key={m.userId} value={`transfer:${m.userId}`}>
                        Transfer ownership to {m.name ?? m.email}
                      </option>
                    ))}
                    <option value="delete">Delete workspace</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="max-w-lg">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Delete My Account
        </button>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h2 className="text-lg font-semibold text-slate-900">Confirm Account Deletion</h2>
            </div>
            <p className="text-sm text-slate-600">
              This action will schedule your account for permanent deletion in 30 days. Type your email address to confirm.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="confirm-email">
                Email Address
              </label>
              <input
                id="confirm-email"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={profile?.email ?? "your@email.com"}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); setConfirmEmail(""); setError(""); }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={!isConfirmValid || submitting}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {submitting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
