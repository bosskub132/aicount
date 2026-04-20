"use client";

import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { CreateWorkspaceConfirmDialog } from "@/components/create-workspace-confirm-dialog";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export default function NewWorkspacePage() {
  const [open, setOpen] = useState(false);
  const [currentName, setCurrentName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const currentId = getWorkspaceTenantId();
    if (!currentId) return;
    fetch("/api/tenants", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j: { data?: Array<{ tenantId: string; tenantName: string }> }) => {
        const found = (j.data ?? []).find((t) => t.tenantId === currentId);
        if (found) setCurrentName(found.tenantName);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Create New Workspace</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Start a new workspace for another company, client, or branch. Each workspace has its own
        books, master data, and team.
      </p>

      <Card className="mt-6 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--primary-light)]">
            <Building2 className="h-6 w-6 text-[var(--primary)]" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Ready to set up a new workspace?
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Creating a new workspace starts a fresh onboarding flow. Your current workspace
              {currentName ? <> <b>{currentName}</b></> : ""} will stay active in the background —
              you can switch back anytime.
            </p>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setOpen(true)}
              className="mt-4"
            >
              Start creating workspace
            </Button>
          </div>
        </div>
      </Card>

      <CreateWorkspaceConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        currentWorkspaceName={currentName}
      />
    </div>
  );
}
