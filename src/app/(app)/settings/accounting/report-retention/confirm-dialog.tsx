"use client";

import { ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";

export interface Change {
  field: string;
  oldValue: string;
  newValue: string;
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  changes: Change[];
  reductionWarning: boolean;
  legalWarning: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading,
  changes,
  reductionWarning,
  legalWarning,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Policy Changes"
      size="lg"
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={loading}>
            Confirm & Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">ยืนยันการเปลี่ยนนโยบาย</p>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Changes Summary
          </h4>
          <div className="space-y-1.5">
            {changes.map((c) => (
              <div key={c.field} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--foreground)]">{c.field}:</span>
                <span className="line-through text-[var(--muted-foreground)]">{c.oldValue}</span>
                <ArrowRight className="h-3 w-3 text-[var(--muted-foreground)]" />
                <span className="font-semibold text-[var(--foreground)]">{c.newValue}</span>
              </div>
            ))}
          </div>
        </div>

        {reductionWarning && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-xs text-red-700">
              Reducing retention may cause existing reports that exceed the new limit to be moved to Trash within 24
              hours.
            </p>
          </div>
        )}

        {legalWarning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-700">
              Financial Statements and Tax Reports have a legal minimum retention of 5 years under Thai law. Setting a
              shorter period may result in non-compliance.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
