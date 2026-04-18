"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Mail, UserPlus, Send, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Modal } from "@/components/modal";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface InvitationRow {
  invitationId: string;
  email: string;
  role: "maker" | "checker";
  status: "pending" | "accepted" | "expired";
  createdAt: string;
  [key: string]: unknown;
}

const ROLE_OPTIONS = [
  { value: "maker", label: "Maker" },
  { value: "checker", label: "Checker" },
];

export default function WorkspaceInvitationsPage() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"maker" | "checker">("maker");

  // Modal state for revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<InvitationRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    const id = getWorkspaceTenantId();
    setTenantId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    void fetchInvitations(id);
  }, []);

  const fetchInvitations = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tenants/${id}/invitations`, {
        headers: { "x-tenant-id": id },
      });
      const json = (await response.json()) as { success: boolean; data?: InvitationRow[]; error?: string };
      if (json.success) {
        setInvitations(json.data ?? []);
      } else {
        toast.error(json.error ?? "Failed to load invitations");
      }
    } catch {
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);

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
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        setInviteRole("maker");
        void fetchInvitations(tenantId);
      } else {
        toast.error(json.error ?? "Failed to send invitation");
      }
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(invitation: InvitationRow) {
    setRevoking(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/invitations`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ invitationId: invitation.invitationId }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Invitation revoked");
        setRevokeTarget(null);
        void fetchInvitations(tenantId);
      } else {
        toast.error(json.error ?? "Failed to revoke invitation");
      }
    } catch {
      toast.error("Failed to revoke invitation");
    } finally {
      setRevoking(false);
    }
  }

  async function handleResend(invitationId: string) {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/invitations/${invitationId}/resend`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Invitation resent");
        await fetchInvitations(tenantId);
      } else {
        toast.error(json.error || "Failed to resend");
      }
    } catch {
      toast.error("Failed to resend invitation");
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return invitations;
    return [...invitations].sort((a, b) => {
      const aVal = String(a[sortKey as keyof InvitationRow] ?? "");
      const bVal = String(b[sortKey as keyof InvitationRow] ?? "");
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [invitations, sortKey, sortDir]);

  const columns: Column<InvitationRow>[] = [
    { key: "email", header: "Email", sortable: true },
    {
      key: "role",
      header: "Role",
      width: "120px",
      sortable: true,
      render: (row) => (
        <Badge variant={row.role === "maker" ? "processing" : "default"}>
          {row.role}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      sortable: true,
      render: (row) => {
        const variantMap = { pending: "draft", accepted: "approved", expired: "void" } as const;
        return <Badge variant={variantMap[row.status]}>{row.status}</Badge>;
      },
    },
    {
      key: "createdAt",
      header: "Sent Date",
      width: "160px",
      sortable: true,
      render: (row) => <span className="text-[var(--muted-foreground)]">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      width: "180px",
      sortable: false,
      render: (row) =>
        row.status === "pending" ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                void handleResend(row.invitationId);
              }}
            >
              Resend
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5 text-[var(--destructive)]" />}
              onClick={(e) => {
                e.stopPropagation();
                setRevokeTarget(row);
              }}
            >
              Revoke
            </Button>
          </div>
        ) : (
          <span className="text-[var(--muted-foreground)]">&mdash;</span>
        ),
    },
  ];

  if (!tenantId && !loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Invitations</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Invite members to your workspace.</p>
          </div>
        </div>
        <div className="flex max-w-2xl flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-sm">
          <Mail className="mb-3 h-10 w-10 text-[var(--muted-foreground)]" />
          <p className="text-sm font-medium text-[var(--foreground)]">No workspace selected</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Select a workspace to manage invitations.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Invitations</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Invite members to your workspace.</p>
        </div>
      </div>

      {/* Invite form */}
      <div className="max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[var(--muted-foreground)]" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Invite Member</h2>
        </div>
        <form onSubmit={handleSendInvite} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Email address"
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
            />
          </div>
          <div>
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={inviteRole}
              onChange={(v) => setInviteRole(v as "maker" | "checker")}
            />
          </div>
          <Button
            type="submit"
            loading={sending}
            icon={<Send className="h-4 w-4" />}
          >
            {sending ? "Sending..." : "Send Invite"}
          </Button>
        </form>
      </div>

      {/* Data Table */}
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <DataTable<InvitationRow>
          columns={columns}
          data={sorted}
          keyField="invitationId"
          sortable
          onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
          emptyMessage={loading ? "Loading invitations..." : "No invitations sent yet."}
        />
      </div>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Invitation"
        actions={
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={revoking}
              onClick={() => revokeTarget && handleRevoke(revokeTarget)}
            >
              Revoke
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to revoke the invitation for{" "}
          <strong>{revokeTarget?.email}</strong>?
        </p>
      </Modal>
    </section>
  );
}
