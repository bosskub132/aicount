"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, AlertTriangle } from "lucide-react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { UploadQueue } from "@/components/upload-queue";
import type { UploadFile } from "@/components/upload-queue";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { useToast } from "@/lib/stores/ui-store";
import { useRouter } from "next/navigation";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const OCR_POLL_INTERVAL = 3000;

interface RecentDocument {
  id: string;
  fileName: string;
  issuerName?: string;
  grandTotal?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDefaultTenant, setIsDefaultTenant] = useState(false);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const toast = useToast();
  const router = useRouter();

  // Check tenant on mount
  useEffect(() => {
    const tid = getWorkspaceTenantId();
    setIsDefaultTenant(!tid);
  }, []);

  // Cleanup poll timers and preview URLs on unmount
  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.has(file.type)) {
      return `Invalid file type: ${file.type || "unknown"}. Allowed: PDF, JPG, PNG, WEBP`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum: 10 MB`;
    }
    return null;
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const newEntries: UploadFile[] = [];
    let invalidCount = 0;

    Array.from(fileList).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        invalidCount++;
        toast.warning(`${file.name}: ${error}`);
        return;
      }
      newEntries.push({
        id: crypto.randomUUID(),
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        status: "queued",
      });
    });

    if (invalidCount > 0 && newEntries.length === 0) {
      return;
    }

    setFiles((prev) => [...prev, ...newEntries]);
  }

  function removeFile(id: string) {
    // Stop polling if active
    const timer = pollTimers.current.get(id);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(id);
    }

    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  function retryFile(id: string) {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "queued" as const, error: undefined, progress: undefined } : f))
    );
  }

  function clearAll() {
    // Stop all polls
    pollTimers.current.forEach((timer) => clearInterval(timer));
    pollTimers.current.clear();

    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
  }

  function viewDocument(docId: string) {
    router.push(`/documents/${docId}`);
  }

  const startOcrPolling = useCallback((fileId: string, documentId: string) => {
    // Don't start duplicate timers
    if (pollTimers.current.has(fileId)) return;

    const timer = setInterval(async () => {
      try {
        const tid = getWorkspaceTenantId();
        const res = await fetch(`/api/documents/${documentId}`);
        if (!res.ok) return;

        const json = await res.json();
        const doc = json.data;

        // Poll uses document status (not ocrStatus which doesn't exist)
        // DRAFT = still processing, anything else = OCR finished
        if (doc && doc.status !== "DRAFT") {
          // OCR finished — stop polling
          clearInterval(timer);
          pollTimers.current.delete(fileId);

          const isDone = doc.status !== "QUERY" || doc.extractionStatus === "completed";
          const extractedData = isDone
            ? {
                issuerName: doc.issuerName,
                grandTotal: doc.grandTotal?.toString(),
              }
            : undefined;

          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: isDone ? "done" : "failed",
                    extractedData,
                    error: isDone ? undefined : `OCR failed: ${doc.extractionFailureReason || doc.status}`,
                  }
                : f
            )
          );

          if (isDone) {
            toast.success(`OCR complete: ${doc.originalFilename || "document"}`);
            setRecentDocs((prev) => [
              {
                id: documentId,
                fileName: doc.originalFilename || "Document",
                issuerName: extractedData?.issuerName,
                grandTotal: extractedData?.grandTotal,
              },
              ...prev,
            ]);
          } else {
            toast.error(`OCR failed for ${doc.originalFilename || "document"}`);
          }
        }
      } catch {
        // Silently retry on next interval
      }
    }, OCR_POLL_INTERVAL);

    pollTimers.current.set(fileId, timer);
  }, [toast]);

  async function handleUpload() {
    const queued = files.filter((f) => f.status === "queued");
    if (queued.length === 0) return;

    setUploading(true);

    // Set queued files to uploading
    setFiles((prev) =>
      prev.map((f) => (f.status === "queued" ? { ...f, status: "uploading" as const, progress: 0 } : f))
    );

    const form = new FormData();
    for (const entry of queued) {
      form.append("files", entry.file);
    }
    form.append("tenantId", getWorkspaceTenantId());

    try {
      const response = await fetch("/api/documents/upload-batch", {
        method: "POST",
        body: form,
      });
      const json = await response.json();

      if (!json.success) {
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "uploading" ? { ...f, status: "failed" as const, error: json.error || "Upload failed" } : f
          )
        );
        toast.error(json.error || "Upload failed");
        setUploading(false);
        return;
      }

      const documents: Array<{ id: string; originalFilename: string }> = json.data?.documents || [];
      const duplicates = new Set<string>(json.data?.duplicateFiles || []);

      // Map uploaded files to their documentIds and start OCR polling
      setFiles((prev) => {
        const uploadingFiles = prev.filter((f) => f.status === "uploading");
        return prev.map((f) => {
          if (f.status !== "uploading") return f;

          const idx = uploadingFiles.indexOf(f);
          const doc = documents[idx];
          const isDuplicate = duplicates.has(f.file.name);

          if (doc) {
            // Start polling for OCR status
            startOcrPolling(f.id, doc.id);
            return {
              ...f,
              status: "processing" as const,
              documentId: doc.id,
              isDuplicate,
              progress: 100,
            };
          }

          return {
            ...f,
            status: isDuplicate ? ("done" as const) : ("failed" as const),
            isDuplicate,
            error: isDuplicate ? undefined : "No document ID returned",
          };
        });
      });

      const uploadedCount = documents.length;
      const dupCount = duplicates.size;
      if (dupCount > 0) {
        toast.warning(`${uploadedCount} uploaded, ${dupCount} duplicate${dupCount !== 1 ? "s" : ""} detected`);
      } else {
        toast.success(`${uploadedCount} file${uploadedCount !== 1 ? "s" : ""} uploaded — OCR processing started`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setFiles((prev) =>
        prev.map((f) => (f.status === "uploading" ? { ...f, status: "failed" as const, error: message } : f))
      );
      toast.error(message);
    }

    setUploading(false);
  }

  const queuedCount = files.filter((f) => f.status === "queued").length;
  const hasFiles = files.length > 0;

  // -- Render --

  if (isDefaultTenant) {
    return (
      <section className="w-full space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Upload Documents</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Upload receipts, invoices, or other accounting documents for OCR processing.
          </p>
        </div>
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-[var(--warning-light)] p-3">
              <AlertTriangle className="h-6 w-6 text-[var(--warning)]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">
              Select a Workspace First
            </h3>
            <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">
              Please select a client workspace from the sidebar before uploading documents.
            </p>
            <div className="mt-4">
              <Link href="/settings">
                <Button>Go to Settings</Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Upload Documents</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Upload receipts, invoices, or other accounting documents for OCR processing.
          </p>
        </div>
        {hasFiles && queuedCount > 0 && (
          <Button onClick={handleUpload} loading={uploading} icon={<Upload className="h-4 w-4" />}>
            Upload ({queuedCount})
          </Button>
        )}
      </div>

      {/* Drop Zone */}
      <div
        className={`relative rounded-[var(--radius-card)] border-2 border-dashed transition-all ${
          dragActive
            ? "border-[var(--primary)] bg-[var(--primary-light)]"
            : "border-[var(--border)] bg-[var(--muted)] hover:border-[var(--border-hover)]"
        } ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex flex-col items-center py-12">
          <div className={`rounded-full p-3 ${dragActive ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--muted-foreground)]"}`}>
            <Upload className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
            {dragActive ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">or click to browse</p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            PDF, JPG, PNG, WEBP — max 10 MB each
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Upload Queue */}
      <UploadQueue
        files={files}
        onRemove={removeFile}
        onRetry={retryFile}
        onClearAll={clearAll}
        onViewDocument={viewDocument}
      />

      {/* Upload action for when there are files but button is below */}
      {hasFiles && queuedCount > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleUpload} loading={uploading} icon={<Upload className="h-4 w-4" />}>
            Upload ({queuedCount})
          </Button>
        </div>
      )}

      {/* Recently Uploaded Section */}
      {recentDocs.length > 0 && (
        <Card title="Recently Uploaded">
          <div className="divide-y divide-[var(--border)] -m-5">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{doc.fileName}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {doc.issuerName && <span>{doc.issuerName}</span>}
                      {doc.grandTotal && (
                        <span className={doc.issuerName ? "ml-3" : ""}>
                          ฿{Number(doc.grandTotal).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Link href={`/documents/${doc.id}`}>
                  <Button variant="ghost" size="sm">View</Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Footer links */}
      <div className="flex gap-2">
        <Link href="/documents">
          <Button variant="secondary">View All Documents</Button>
        </Link>
      </div>
    </section>
  );
}
