"use client";

import { Download, Lock, Info } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Skeleton } from "@/components/skeleton";

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  reportMetadata?: {
    reportType: string;
    period: string;
    generatedBy?: string;
    generatedAt?: string;
    isLocked?: boolean;
  };
  onDownload?: () => void;
  onLock?: () => void;
  isLocking?: boolean;
}

export function PdfPreviewModal({
  isOpen,
  onClose,
  pdfUrl,
  reportMetadata,
  onDownload,
  onLock,
  isLocking = false,
}: PdfPreviewModalProps) {
  const title = reportMetadata
    ? `PDF Preview — ${reportMetadata.reportType}`
    : "PDF Preview";

  return (
    <Modal open={isOpen} onClose={onClose} title={title} size="lg">
      <div className="flex flex-col" style={{ height: "70vh", maxWidth: "56rem", margin: "0 -1.5rem -1.5rem" }}>
        {/* Subtitle */}
        {reportMetadata?.period && (
          <p className="px-6 pb-3 text-xs text-[var(--muted-foreground)]">
            {reportMetadata.period}
          </p>
        )}

        {/* PDF iframe or loading skeleton */}
        <div className="flex-1 min-h-0 bg-[var(--muted)] mx-4 rounded-[var(--radius-card)] overflow-hidden">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="PDF Preview"
              className="h-full w-full border-none"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="w-full max-w-md space-y-4">
                <Skeleton variant="rect" height="24px" />
                <Skeleton variant="rect" height="300px" />
                <Skeleton variant="rect" height="24px" width="60%" />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-[var(--border)]">
          {/* Metadata */}
          <div className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)] truncate">
            {reportMetadata?.generatedBy && (
              <span>By {reportMetadata.generatedBy}</span>
            )}
            {reportMetadata?.generatedBy && reportMetadata?.generatedAt && (
              <span className="mx-1">&middot;</span>
            )}
            {reportMetadata?.generatedAt && (
              <span>{reportMetadata.generatedAt}</span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onDownload && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={onDownload}
                aria-label="Download PDF"
              >
                Download
              </Button>
            )}

            {reportMetadata?.isLocked ? (
              <Badge className="bg-[var(--info-light)] text-[var(--primary)]">
                <Info className="mr-1 h-3 w-3" />
                Locked
              </Badge>
            ) : (
              onLock && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Lock className="h-4 w-4" />}
                  onClick={onLock}
                  loading={isLocking}
                  aria-label="Lock as Official"
                >
                  Lock as Official
                </Button>
              )
            )}

            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
