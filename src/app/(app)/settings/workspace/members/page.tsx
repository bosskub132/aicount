"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Trash2 } from "lucide-react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type MemberRow = {
  assignmentId: string;
  userId: string;
  assignmentRole: "maker" | "checker";
  email: string;
  name: string | null;
};

type DisplayMember = {
  userId: string;
  email: string;
  name: string | null;
  role: "admin" | "maker" | "checker";
  assignmentIds: string[];
};

export default function WorkspaceMembersPage() {
  const [tenantId, setTenantId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = getWorkspaceTenantId();
    setTenantId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    void fetchMembers(id);

    // Get current user ID
    fetch("/api/auth/profile").then(r => r.json()).then(json => {
      if (json.success && json.data?.id) setCurrentUserId(json.data.id);
    }).catch(() => {});
  }, []);

  async function fetchMembers(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/tenants/${id}/assignments`, {
        headers: { "x-tenant-id": id },
      });
      const json = (await response.json()) as { success: boolean; data?: MemberRow[]; error?: string };
      if (json.success) {
        setMembers(json.data ?? []);
      } else {
        setError(json.error ?? "Failed to load members");
      }
    } catch {
      setError("Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(assignmentId: string, email: string) {
    const confirmed = window.confirm(`Remove ${email} from this workspace?`);
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/tenants/${tenantId}/assignments`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ assignmentId }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        setMessage("Member removed.");
        setTimeout(() => setMessage(""), 3000);
        void fetchMembers(tenantId);
      } else {
        setError(json.error ?? "Failed to remove member");
      }
    } catch {
      setError("Failed to remove member");
    }
  }

  // Deduplicate: users with both maker + checker = admin (owner)
  const displayMembers: DisplayMember[] = useMemo(() => {
    const map = new Map<string, DisplayMember>();
    for (const m of members) {
      const existing = map.get(m.userId);
      if (existing) {
        existing.assignmentIds.push(m.assignmentId);
        // Has both roles = admin
        existing.role = "admin";
      } else {
        map.set(m.userId, {
          userId: m.userId,
          email: m.email,
          name: m.name,
          role: m.assignmentRole,
          assignmentIds: [m.assignmentId],
        });
      }
    }
    return Array.from(map.values());
  }, [members]);

  if (!tenantId && !loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-slate-500" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Members &amp; Roles</h1>
            <p className="text-sm text-slate-500">Manage workspace members and their roles.</p>
          </div>
        </div>
        <div className="flex max-w-2xl flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Users className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No workspace selected</p>
          <p className="mt-1 text-xs text-slate-400">Select a workspace to manage its members.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-slate-500" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Members &amp; Roles</h1>
          <p className="text-sm text-slate-500">Manage workspace members and their roles.</p>
        </div>
      </div>

      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Loading...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayMembers.map((member) => {
                const isCurrentUser = member.userId === currentUserId;
                const roleColor = member.role === "admin"
                  ? "bg-amber-50 text-amber-700"
                  : member.role === "checker"
                    ? "bg-purple-50 text-purple-700"
                    : "bg-blue-50 text-blue-700";
                return (
                  <tr key={member.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">
                      {member.name ?? "-"}
                      {isCurrentUser && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{member.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleColor}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isCurrentUser ? (
                        <span className="text-xs text-slate-400">Owner</span>
                      ) : (
                        <button
                          onClick={() => void handleRemove(member.assignmentIds[0], member.email)}
                          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!displayMembers.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                    No members found.
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
