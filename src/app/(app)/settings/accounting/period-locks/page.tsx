"use client";

import { useEffect, useState, useMemo } from "react";
import { Lock, LockOpen, Shield } from "lucide-react";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface PeriodLockRow {
  yearMonth: string;
  isLocked: boolean;
  lockedBy: string | null;
  lockedByName: string | null;
  lockedAt: string | null;
  [key: string]: unknown;
}

interface PeriodLockApiItem {
  yearMonth: string;
  lockedBy: string;
  lockedByName?: string | null;
  lockedAt: string;
}

/** Generate last `count` months as YYYY-MM strings */
function generatePeriods(count = 24): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return periods;
}

function formatDate(iso: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccountingPeriodLocksPage() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [locks, setLocks] = useState<PeriodLockApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<string | null>(null);

  useEffect(() => {
    const id = getWorkspaceTenantId();
    setTenantId(id);
  }, []);

  async function loadLocks() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/period-locks`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = (await response.json()) as {
        success: boolean;
        data?: PeriodLockApiItem[];
        error?: string;
      };
      if (json.success) {
        setLocks(json.data || []);
      } else {
        toast.error(json.error || "Failed to load period locks");
      }
    } catch {
      toast.error("Failed to load period locks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const rows: PeriodLockRow[] = useMemo(() => {
    const periods = generatePeriods(24);
    const lockMap = new Map(locks.map((l) => [l.yearMonth, l]));
    return periods.map((ym) => {
      const lock = lockMap.get(ym);
      return {
        yearMonth: ym,
        isLocked: !!lock,
        lockedBy: lock?.lockedBy ?? null,
        lockedByName: lock?.lockedByName ?? null,
        lockedAt: lock?.lockedAt ?? null,
      };
    });
  }, [locks]);

  async function handleLock(yearMonth: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/period-locks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ yearMonth }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (json.success) {
        toast.success(`Period ${yearMonth} locked`);
        await loadLocks();
      } else {
        toast.error(json.error || "Failed to lock period");
      }
    } catch {
      toast.error("Failed to lock period");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlock() {
    if (!unlockTarget) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/period-locks`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ yearMonth: unlockTarget }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (json.success) {
        toast.success(`Period ${unlockTarget} unlocked`);
        setUnlockTarget(null);
        await loadLocks();
      } else {
        toast.error(json.error || "Failed to unlock period");
      }
    } catch {
      toast.error("Failed to unlock period");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<PeriodLockRow>[] = [
    {
      key: "yearMonth",
      header: "Period",
      width: "120px",
      sortable: false,
      render: (row) => (
        <span className="font-medium tabular-nums">{row.yearMonth}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      sortable: false,
      render: (row) =>
        row.isLocked ? (
          <Badge variant="rejected">Locked</Badge>
        ) : (
          <Badge variant="approved">Open</Badge>
        ),
    },
    {
      key: "lockedByName",
      header: "Locked By",
      sortable: false,
      render: (row) => (
        <span className="text-[var(--muted-foreground)]">
          {row.lockedByName || "\u2014"}
        </span>
      ),
    },
    {
      key: "lockedAt",
      header: "Locked At",
      width: "200px",
      sortable: false,
      render: (row) => (
        <span className="text-[var(--muted-foreground)] tabular-nums">
          {formatDate(row.lockedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "120px",
      sortable: false,
      render: (row) =>
        row.isLocked ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<LockOpen className="h-3.5 w-3.5" />}
            disabled={saving}
            onClick={(e) => {
              e.stopPropagation();
              setUnlockTarget(row.yearMonth);
            }}
          >
            Unlock
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={<Lock className="h-3.5 w-3.5" />}
            loading={saving}
            onClick={(e) => {
              e.stopPropagation();
              handleLock(row.yearMonth);
            }}
          >
            Lock
          </Button>
        ),
    },
  ];

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              Period Locks
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to manage period
              locks.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Lock className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Period Locks
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Prevent changes to closed accounting periods.
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <DataTable<PeriodLockRow>
          columns={columns}
          data={rows}
          keyField="yearMonth"
          emptyMessage={loading ? "Loading periods..." : "No periods found."}
        />
      </div>

      {/* Unlock Confirmation Modal */}
      <Modal
        open={!!unlockTarget}
        onClose={() => setUnlockTarget(null)}
        title="Unlock Period"
        actions={
          <>
            <Button variant="secondary" onClick={() => setUnlockTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={saving}
              onClick={handleUnlock}
            >
              Unlock
            </Button>
          </>
        }
      >
        <p>
          Unlocking <strong>{unlockTarget}</strong> allows changes to posted
          entries in this period. Are you sure?
        </p>
      </Modal>
    </section>
  );
}
