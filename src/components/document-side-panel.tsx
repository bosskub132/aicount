// src/components/document-side-panel.tsx
"use client";

import { X, Trash2 } from "lucide-react";
import { useDocument } from "@/lib/hooks/use-documents";
import { ConfidenceBar } from "@/components/confidence-bar";
import { StatusBadge } from "@/components/badge";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/skeleton";

function isSafeFileUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Allow relative paths (local uploads)
  if (url.startsWith("/")) return true;
  // Allow Supabase storage URLs
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

interface DocumentSidePanelProps {
  documentId: string | null;
  onClose: () => void;
  onAction?: (action: string, docId: string) => void;
}

export function DocumentSidePanel({ documentId, onClose, onAction }: DocumentSidePanelProps) {
  const { data: doc, isLoading } = useDocument(documentId);

  if (!documentId) return null;

  return (
    <div className="w-[400px] shrink-0 border-l border-[var(--border)] bg-white flex flex-col overflow-hidden transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
          {isLoading ? <Skeleton variant="text" className="w-32" /> : doc?.issuerName || "Document"}
        </h3>
        <button onClick={onClose} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer" aria-label="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton variant="rect" className="h-40 w-full" />
            <Skeleton variant="text" className="w-full" />
            <Skeleton variant="text" className="w-3/4" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
        ) : doc ? (
          <>
            {/* Preview thumbnail */}
            {doc.fileUrl && isSafeFileUrl(doc.fileUrl) && (
              <div className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--border)] bg-[var(--muted)] h-48 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={doc.fileUrl} alt="Document" className="max-h-full max-w-full object-contain" />
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-between">
              <StatusBadge status={doc.status} />
              {doc.confidenceScore != null && (
                <div className="w-24">
                  <ConfidenceBar score={doc.confidenceScore} size="sm" />
                </div>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-2 text-sm">
              <Field label="Issuer" value={doc.issuerName} />
              <Field label="Tax ID" value={doc.issuerTaxId} />
              <Field label="Amount" value={doc.grandTotal ? `฿${Number(doc.grandTotal).toLocaleString()}` : null} className="tabular-nums" />
              <Field label="VAT" value={doc.vatAmount ? `฿${Number(doc.vatAmount).toLocaleString()}` : null} className="tabular-nums" />
              <Field label="Date" value={doc.documentDate ? new Date(doc.documentDate).toLocaleDateString("th-TH") : null} />
              <Field label="Doc Number" value={doc.documentNumber} />
              <Field label="Direction" value={doc.direction} />
              <Field label="Type" value={doc.docType} />
            </div>
          </>
        ) : null}
      </div>

      {/* Actions */}
      {doc && (
        <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
          {(doc.status === "DRAFT" || doc.status === "ACTION_REQUIRED" || doc.status === "QUERY" || doc.status === "REJECTED") && (
            <Button variant="secondary" size="sm" className="w-full" onClick={() => onAction?.("edit", doc.id)}>
              Edit Details
            </Button>
          )}
          {(doc.status === "DRAFT" || doc.status === "ACTION_REQUIRED" || doc.status === "REJECTED") && (
            <Button variant="primary" size="sm" className="w-full" onClick={() => onAction?.("submit", doc.id)}>
              Submit for Approval
            </Button>
          )}
          {doc.status === "QUERY" && (
            <Button variant="secondary" size="sm" className="w-full" onClick={() => onAction?.("re-ocr", doc.id)}>
              Re-process OCR
            </Button>
          )}
          {(doc.status === "OCR_PROCESSING" || doc.status === "DRAFT") && (
            <Button variant="destructive" size="sm" className="w-full" icon={<Trash2 className="h-4 w-4" />} onClick={() => onAction?.("delete", doc.id)}>
              Delete Document
            </Button>
          )}
          {doc.status === "PENDING_APPROVAL" && (
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" className="flex-1" onClick={() => onAction?.("reject", doc.id)}>
                Reject
              </Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={() => onAction?.("approve", doc.id)}>
                Approve
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className={`text-[var(--foreground)] font-medium ${className || ""}`}>{value}</span>
    </div>
  );
}
