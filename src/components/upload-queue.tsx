// src/components/upload-queue.tsx
"use client";

import { CheckCircle2, XCircle, Loader2, FileText, X } from "lucide-react";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";

export interface UploadFile {
  id: string;
  file: File;
  preview?: string;
  status: "queued" | "uploading" | "uploaded" | "processing" | "done" | "failed";
  progress?: number;
  documentId?: string;
  extractedData?: { issuerName?: string; grandTotal?: string };
  error?: string;
  isDuplicate?: boolean;
}

interface UploadQueueProps {
  files: UploadFile[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onClearAll: () => void;
  onViewDocument: (docId: string) => void;
}

const statusConfig = {
  queued: { icon: FileText, color: "text-[var(--muted-foreground)]", label: "Queued" },
  uploading: { icon: Loader2, color: "text-[var(--primary)]", label: "Uploading" },
  uploaded: { icon: Loader2, color: "text-[var(--primary)]", label: "Uploaded" },
  processing: { icon: Loader2, color: "text-[var(--warning)]", label: "Processing OCR" },
  done: { icon: CheckCircle2, color: "text-[var(--success)]", label: "Done" },
  failed: { icon: XCircle, color: "text-[var(--destructive)]", label: "Failed" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadQueue({ files, onRemove, onRetry, onClearAll, onViewDocument }: UploadQueueProps) {
  if (files.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
        <p className="text-sm font-medium text-[var(--foreground)]">Upload Queue ({files.length} files)</p>
        <Button variant="ghost" size="sm" onClick={onClearAll}>Clear All</Button>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {files.map((f) => {
          const cfg = statusConfig[f.status];
          const Icon = cfg.icon;
          const isAnimated = f.status === "uploading" || f.status === "processing" || f.status === "uploaded";
          return (
            <div key={f.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${cfg.color} ${isAnimated ? "animate-spin" : ""}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{f.file.name}</p>
                    <span className="text-xs text-[var(--muted-foreground)]">{formatFileSize(f.file.size)}</span>
                    {f.isDuplicate && <Badge variant="pending">Duplicate</Badge>}
                  </div>
                  {/* Progress bar */}
                  {(f.status === "uploading" || f.status === "processing") && f.progress != null && (
                    <div className="mt-1.5 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${f.progress}%` }} />
                    </div>
                  )}
                  {/* Extracted data preview */}
                  {f.status === "done" && f.extractedData && (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {f.extractedData.issuerName && <span>Issuer: {f.extractedData.issuerName}</span>}
                      {f.extractedData.grandTotal && <span className="ml-3">Amount: ฿{Number(f.extractedData.grandTotal).toLocaleString()}</span>}
                    </p>
                  )}
                  {/* Error message */}
                  {f.status === "failed" && f.error && (
                    <p className="mt-1 text-xs text-[var(--destructive)]">{f.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {f.status === "done" && f.documentId && (
                    <Button variant="link" size="sm" onClick={() => onViewDocument(f.documentId!)}>View</Button>
                  )}
                  {f.status === "failed" && (
                    <Button variant="ghost" size="sm" onClick={() => onRetry(f.id)}>Retry</Button>
                  )}
                  <button onClick={() => onRemove(f.id)} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer" aria-label="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
