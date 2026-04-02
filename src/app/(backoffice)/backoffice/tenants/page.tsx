"use client";

import { Skeleton } from "@/components/skeleton";
import { useBackofficeTenants } from "@/lib/hooks/use-backoffice";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function BackofficeTenantsPage() {
  const mounted = useMounted();
  const { data: tenants, isLoading: queryLoading } = useBackofficeTenants();
  const isLoading = !mounted || queryLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Tenants</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          All registered workspaces
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--muted)]">
                  Name
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--muted)]">
                  Tax ID
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--muted)]">
                  Members
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--muted)]">
                  Documents
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--muted)]">
                  Budget
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--muted)]">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants?.map(
                (t: {
                  id: string;
                  name: string;
                  taxId: string | null;
                  memberCount: number;
                  documentCount: number;
                  monthlyBudgetUsd: number | null;
                  createdAt: string;
                }) => (
                  <tr key={t.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="px-3 py-2 border-b border-[var(--muted)] font-medium">
                      {t.name}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] text-[var(--muted-foreground)] font-mono text-xs">
                      {t.taxId || "—"}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] text-right tabular-nums">
                      {t.memberCount}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] text-right tabular-nums">
                      {t.documentCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] text-right tabular-nums">
                      {t.monthlyBudgetUsd !== null ? (
                        `$${t.monthlyBudgetUsd.toFixed(2)}`
                      ) : (
                        <span className="text-[var(--muted-foreground)]">Not set</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--muted)] text-[var(--muted-foreground)]">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {tenants?.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              No tenants found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
