"use client";

import { useEffect, useState } from "react";
import { Mail, UserPlus, Send, Trash2 } from "lucide-react";

type Invitation = {
  invitationId: string;
  email: string;
  role: "maker" | "checker";
  status: "pending" | "accepted" | "expired";
  createdAt: string;
};

const statusBadge: Record<Invitation["status"], string> = {
  pending: "bg-yellow-50 text-yellow-700",
  accepted: "bg-green-50 text-green-700",
  expired: "bg-slate-100 text-slate-500",
};

export default function WorkspaceInvitationsPage() {
  const [tenantId, setTenantId] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"maker" | "checker">("maker");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("workspaceTenantId") ?? "";
    setTenantId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    void fetchInvitations(id);
  }, []);

  async function fetchInvitations(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/tenants/${id}/invitations`, {
        headers: { "x-tenant-id": id },
      });
      const json = (await response.json()) as { success: boolean; data?: Invitation[]; error?: string };
      if (json.success) {
        setInvitations(json.data ?? []);
      } else {
        setError(json.error ?? "Failed to load invitations");
      }
    } catch {
      setError("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/tenants/${tenantId}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        setMessage(`Invitation sent to ${inviteEmail}.`);
        setTimeout(() => setMessage(""), 4000);
        setInviteEmail("");
        setInviteRole("maker");
        void fetchInvitations(tenantId);
      } else {
        setError(json.error ?? "Failed to send invitation");
      }
    } catch {
      setError("Failed to send invitation");
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(invitationId: string, email: string) {
    const confirmed = window.confirm(`Revoke invitation for ${email}?`);
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/tenants/${tenantId}/invitations`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ invitationId }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        setMessage("Invitation revoked.");
        setTimeout(() => setMessage(""), 3000);
        void fetchInvitations(tenantId);
      } else {
        setError(json.error ?? "Failed to revoke invitation");
      }
    } catch {
      setError("Failed to revoke invitation");
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  if (!tenantId && !loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-slate-500" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Invitations</h1>
            <p className="text-sm text-slate-500">Invite members to your workspace.</p>
          </div>
        </div>
        <div className="flex max-w-2xl flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Mail className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No workspace selected</p>
          <p className="mt-1 text-xs text-slate-400">Select a workspace to manage invitations.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-slate-500" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invitations</h1>
          <p className="text-sm text-slate-500">Invite members to your workspace.</p>
        </div>
      </div>

      {/* Invite form */}
      <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Invite Member</h2>
        </div>
        <form onSubmit={handleSendInvite} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 space-y-1 min-w-[200px]">
            <label className="text-xs font-medium text-slate-600" htmlFor="invite-email">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="invite-role">
              Role
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "maker" | "checker")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="maker">Maker</option>
              <option value="checker">Checker</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </form>
      </div>

      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* Invitations table */}
      <div className="max-w-2xl overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Loading...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Sent</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.map((inv) => (
                <tr key={inv.invitationId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{inv.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.role === "checker" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {inv.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3">
                    {inv.status === "pending" ? (
                      <button
                        onClick={() => void handleRevoke(inv.invitationId, inv.email)}
                        className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!invitations.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                    No invitations sent yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
