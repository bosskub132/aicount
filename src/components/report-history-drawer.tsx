"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  X,
  Eye,
  Download,
  Lock,
  Unlock,
  Trash2,
  RotateCcw,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";

interface ReportHistoryItem {
  id: string;
  reportType: string;
  period: string;
  periodScope: string;
  generatedBy?: string;
  generatedAt: string;
  pdfSizeBytes?: number;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  expiresAt?: string;
}

type FilterValue = "all" | "locked" | "drafts" | "trash";

interface ReportHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: ReportHistoryItem[];
  isLoading?: boolean;
  activeFilter: FilterValue;
  onFilterChange: (filter: FilterValue) => void;
  onDownload: (id: string) => void;
  onLock: (id: string) => void;
  onUnlock: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPreview: (id: string) => void;
}

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Locked", value: "locked" },
  { label: "Drafts", value: "drafts" },
  { label: "Trash", value: "trash" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function isExpiringSoon(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return expiryDate.getTime() - now.getTime() < thirtyDays;
}

function ItemStatusBadge({ item }: { item: ReportHistoryItem }) {
  if (item.isDeleted) {
    return (
      <Badge className="bg-[var(--destructive-light)] text-[var(--destructive)]">
        <Trash2 className="mr-1 h-3 w-3" />
        Trash
      </Badge>
    );
  }
  if (item.isLocked) {
    return (
      <Badge className="bg-[var(--info-light)] text-[var(--primary)]">
        <Lock className="mr-1 h-3 w-3" />
        Locked
      </Badge>
    );
  }
  if (isExpiringSoon(item.expiresAt)) {
    return (
      <Badge className="bg-[var(--warning-light)] text-[var(--warning)]">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Expiring
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700">
      Draft
    </Badge>
  );
}

function HistoryItemCard({
  item,
  onPreview,
  onDownload,
  onLock,
  onUnlock,
  onDelete,
  onRestore,
}: {
  item: ReportHistoryItem;
  onPreview: () => void;
  onDownload: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-3 space-y-2">
      {/* Top row: period + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">
            {item.period}
          </p>
          <span className="text-xs text-[var(--muted-foreground)]">
            {item.periodScope}
          </span>
        </div>
        <ItemStatusBadge item={item} />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        {item.generatedBy && <span>{item.generatedBy}</span>}
        {item.generatedBy && <span>&middot;</span>}
        <span>{item.generatedAt}</span>
        {item.pdfSizeBytes != null && (
          <>
            <span>&middot;</span>
            <span className="tabular-nums">{formatFileSize(item.pdfSizeBytes)}</span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 pt-1">
        {!item.isDeleted && (
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<Eye className="h-3.5 w-3.5" />}
              onClick={onPreview}
              aria-label="Preview report"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={onDownload}
              aria-label="Download report"
            />
            {item.isLocked ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<Unlock className="h-3.5 w-3.5" />}
                onClick={onUnlock}
                aria-label="Unlock report"
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon={<Lock className="h-3.5 w-3.5" />}
                onClick={onLock}
                aria-label="Lock report"
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5 text-[var(--destructive)]" />}
              onClick={onDelete}
              aria-label="Delete report"
            />
          </>
        )}
        {item.isDeleted && (
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={onRestore}
              aria-label="Restore report"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={onDownload}
              aria-label="Download report"
            />
          </>
        )}
      </div>
    </div>
  );
}

function SkeletonItems() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="rect" width="56px" height="20px" />
          </div>
          <Skeleton variant="text" width="80%" />
          <div className="flex gap-1 pt-1">
            <Skeleton variant="rect" width="32px" height="32px" />
            <Skeleton variant="rect" width="32px" height="32px" />
            <Skeleton variant="rect" width="32px" height="32px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportHistoryDrawer({
  isOpen,
  onClose,
  items,
  isLoading = false,
  activeFilter,
  onFilterChange,
  onDownload,
  onLock,
  onUnlock,
  onDelete,
  onRestore,
  onPreview,
}: ReportHistoryDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Trap focus inside drawer when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: "var(--z-modal)" } as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label="Report History"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="absolute right-0 top-0 h-full w-[400px] max-w-full bg-[var(--surface-primary)] shadow-[var(--shadow-lg)] flex flex-col animate-in slide-in-from-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">
            Report History
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius-button)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 px-4 py-3 border-b border-[var(--border)]">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                activeFilter === f.value
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
              }`}
              aria-pressed={activeFilter === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <SkeletonItems />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="No reports found"
              description="No reports match the selected filter."
            />
          ) : (
            <div className="space-y-3 p-4">
              {items.map((item) => (
                <HistoryItemCard
                  key={item.id}
                  item={item}
                  onPreview={() => onPreview(item.id)}
                  onDownload={() => onDownload(item.id)}
                  onLock={() => onLock(item.id)}
                  onUnlock={() => onUnlock(item.id)}
                  onDelete={() => onDelete(item.id)}
                  onRestore={() => onRestore(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { ReportHistoryItem, ReportHistoryDrawerProps };
