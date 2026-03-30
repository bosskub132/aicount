"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, ArrowRight } from "lucide-react";

type TenantData = {
  id: string;
  name: string;
  deletedAt: string | null;
  deletionScheduledFor: string | null;
};

type MemberRow = {
  assignmentId: string;
  userId: string;
  assignmentRole: "maker" | "checker";
  email: string;
  name: string | null;
};

export default function WorkspaceDeletePage() {
  const router = useRouter();

  const [tenantId, setTenantId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Confirmation modal state
  const [showModal, setShowModal] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // Transfer ownership state
  const [newOwnerId, setNewOwnerId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  // Cancel deletion state
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") ?? "";
    setTenantId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        const [tenantRes, membersRes, profileRes] = await Promise.all([
          fetch(`/api/tenants/${id}`, { headers: { "x-tenant-id": id } }),
          fetch(`/api/tenants/${id}/assignments`, { headers: { "x-tenant-id": id } }),
          fetch("/api/auth/profile"),
        ]);
        const profileJson = await profileRes.json();
        if (profileJson.success && profileJson.data?.id) {
          setCurrentUserId(profileJson.data.id);
        }

        const tenantJson = (await tenantRes.json()) as {
          success: boolean;
          data?: TenantData;
          error?: string;
        };
        const membersJson = (await membersRes.json()) as {
          success: boolean;
          data?: MemberRow[];
          error?: string;
        };

        if (tenantJson.success && tenantJson.data) {
          setTenant(tenantJson.data);
        } else {
          setError(tenantJson.error ?? "Failed to load workspace");
        }

        if (membersJson.success) {
          setMembers(membersJson.data ?? []);
        }
      } catch {
        setError("Failed to load workspace data");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  async function handleCancelDeletion() {
    setCancelling(true);
    setCancelError("");
    try {
      const response = await fetch(`/api/tenants/${tenantId}/cancel-deletion`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        router.refresh();
        window.location.reload();
      } else {
        setCancelError(json.error ?? "Failed to cancel deletion");
      }
    } catch {
      setCancelError("Failed to cancel deletion");
    } finally {
      setCancelling(false);
    }
  }

  async function handleTransferAndDelete() {
    if (!newOwnerId) {
      setTransferError("Please select a new owner");
      return;
    }
    setTransferring(true);
    setTransferError("");
    try {
      const response = await fetch(`/api/tenants/${tenantId}/transfer-ownership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ newOwnerId }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        setShowModal(true);
      } else {
        setTransferError(json.error ?? "Failed to transfer ownership");
      }
    } catch {
      setTransferError("Failed to transfer ownership");
    } finally {
      setTransferring(false);
    }
  }

  async function handleConfirmDelete() {
    if (!tenant || confirmName !== tenant.name) return;
    setConfirming(true);
    setConfirmError("");
    try {
      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ action: "soft_delete" }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        router.push("/settings/workspace/general");
      } else {
        setConfirmError(json.error ?? "Failed to schedule deletion");
      }
    } catch {
      setConfirmError("Failed to schedule deletion");
    } finally {
      setConfirming(false);
    }
  }

  // No workspace selected
  if (!tenantId && !loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="h-6 w-6 text-red-500" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Delete Workspace</h1>
            <p className="text-sm text-slate-500">Permanently delete your workspace.</p>
          </div>
        </div>
        <div className="flex max-w-lg flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Trash2 className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No workspace selected</p>
          <p className="mt-1 text-xs text-slate-400">Select a workspace to manage its deletion.</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="h-6 w-6 text-red-500" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Delete Workspace</h1>
          </div>
        </div>
        <p className="text-sm text-slate-500">Loading...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="h-6 w-6 text-red-500" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Delete Workspace</h1>
          </div>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  // Pending deletion state
  if (tenant?.deletedAt) {
    const scheduledDate = tenant.deletionScheduledFor
      ? new Date(tenant.deletionScheduledFor).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "unknown date";

    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="h-6 w-6 text-red-500" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Delete Workspace</h1>
            <p className="text-sm text-slate-500">Permanently delete your workspace.</p>
          </div>
        </div>

        <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-900">
                Workspace scheduled for deletion
              </p>
              <p className="text-sm text-amber-800">
                This workspace is scheduled for permanent deletion on{" "}
                <span className="font-medium">{scheduledDate}</span>. All data will be permanently
                erased and cannot be recovered.
              </p>
            </div>
          </div>
        </div>

        {cancelError ? <p className="max-w-lg text-sm text-red-600">{cancelError}</p> : null}

        <button
          onClick={() => void handleCancelDeletion()}
          disabled={cancelling}
          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {cancelling ? "Cancelling..." : "Cancel Deletion"}
        </button>
      </section>
    );
  }

  // Deduplicate members (each user may have multiple role assignments: maker + checker)
  const uniqueMembers = members.filter(
    (m, i, arr) => arr.findIndex((x) => x.userId === m.userId) === i
  );
  const isSoleMember = uniqueMembers.length <= 1;
  const otherMembers = uniqueMembers.filter((m) => m.userId !== currentUserId);

  return (
    <>
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="h-6 w-6 text-red-500" />
          <div>
            <h1 className="text-2xl font-semibold text-red-700">Delete Workspace</h1>
            <p className="text-sm text-slate-500">Permanently delete your workspace.</p>
          </div>
        </div>

        {/* Warning card */}
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-900">
                You are about to delete{" "}
                <span className="font-bold">{tenant?.name ?? "this workspace"}</span>
              </p>
              <p className="text-sm text-red-800">
                This workspace has{" "}
                <span className="font-medium">
                  {uniqueMembers.length} member{uniqueMembers.length !== 1 ? "s" : ""}
                </span>
                .
              </p>
              <p className="text-sm text-red-800">
                This action will schedule your workspace for permanent deletion in 30 days. All
                documents, journal entries, and data will be permanently erased.
              </p>
            </div>
          </div>
        </div>

        {isSoleMember ? (
          /* Sole member: show delete button directly */
          <div className="max-w-lg space-y-3">
            <p className="text-sm text-slate-600">
              You are the only member of this workspace. No ownership transfer is needed.
              Click below to schedule this workspace for deletion.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete Workspace
            </button>
          </div>
        ) : (
          /* Multiple members: require ownership transfer */
          <div className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-800">
              Transfer ownership before deletion
            </p>
            <p className="text-sm text-slate-600">
              This workspace has other members. Select a new owner who will take over
              management of this workspace after you initiate deletion.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="new-owner">
                Select new owner
              </label>
              <select
                id="new-owner"
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Select a member —</option>
                {otherMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name ? `${m.name} (${m.email})` : m.email}
                  </option>
                ))}
              </select>
            </div>

            {transferError ? <p className="text-sm text-red-600">{transferError}</p> : null}

            <button
              onClick={() => void handleTransferAndDelete()}
              disabled={transferring || !newOwnerId}
              className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              <ArrowRight className="h-4 w-4" />
              {transferring ? "Transferring..." : "Transfer Ownership & Delete"}
            </button>
          </div>
        )}
      </section>

      {/* Confirmation modal */}
      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold text-slate-900">Confirm Workspace Deletion</h2>
            </div>

            <p className="mb-4 text-sm text-slate-600">
              Type the workspace name{" "}
              <span className="font-semibold text-slate-900">{tenant?.name}</span> to confirm.
            </p>

            <div className="space-y-1.5">
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={tenant?.name ?? ""}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {confirmError ? <p className="mt-2 text-sm text-red-600">{confirmError}</p> : null}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setConfirmName("");
                  setConfirmError("");
                }}
                disabled={confirming}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={confirming || confirmName !== tenant?.name}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {confirming ? "Scheduling..." : "Schedule Deletion"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
