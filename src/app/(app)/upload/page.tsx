"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Upload, X, FileText, Image, AlertTriangle, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type FileEntry = {
  file: File;
  id: string;
  preview?: string;
  status: "queued" | "uploading" | "done" | "failed";
  isDuplicate?: boolean;
  detail?: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  return FileText;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasTenant, setHasTenant] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tid = getWorkspaceTenantId();
    if (tid === "00000000-0000-0000-0000-000000000000") setHasTenant(false);
  }, []);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newEntries: FileEntry[] = Array.from(fileList).map((file) => ({
      file,
      id: crypto.randomUUID(),
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      status: "queued" as const,
    }));
    setFiles((prev) => [...prev, ...newEntries]);
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  function clearAll() {
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
  }

  async function handleUpload() {
    const queued = files.filter((f) => f.status === "queued" || f.status === "failed");
    if (!queued.length) return;

    setUploading(true);
    setFiles((prev) => prev.map((f) => (f.status === "queued" || f.status === "failed") ? { ...f, status: "uploading" } : f));

    const form = new FormData();
    for (const entry of queued) form.append("files", entry.file);
    form.append("tenantId", getWorkspaceTenantId());

    try {
      const response = await fetch("/api/documents/upload-batch", {
        method: "POST",
        body: form,
        headers: { "x-tenant-id": getWorkspaceTenantId() },
      });
      const json = await response.json();

      if (!json.success) {
        setFiles((prev) =>
          prev.map((f) => f.status === "uploading" ? { ...f, status: "failed", detail: json.error } : f)
        );
        setUploading(false);
        return;
      }

      const duplicates = new Set<string>(json.data?.duplicateFiles || []);

      setFiles((prev) =>
        prev.map((f) => {
          if (f.status !== "uploading") return f;
          return {
            ...f,
            status: "done",
            isDuplicate: duplicates.has(f.file.name),
          };
        })
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "failed", detail: error instanceof Error ? error.message : "Upload failed" }
            : f
        )
      );
    }
    setUploading(false);
  }

  const queuedCount = files.filter((f) => f.status === "queued" || f.status === "failed").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const dupCount = files.filter((f) => f.isDuplicate).length;
  const totalCount = files.length;

  return (
    <section className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Upload Documents</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload receipts, invoices, or other accounting documents for OCR processing.
        </p>
      </div>

      {!hasTenant && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">No client profile yet</p>
          <p className="mt-1 text-xs text-amber-600">
            Create your first client profile to start uploading documents.
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-block rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700"
          >
            + Create Client Profile
          </Link>
        </div>
      )}

      {/* Upload Area */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div
          className={`relative rounded-xl border-2 border-dashed transition-all ${
            dragActive
              ? "border-blue-400 bg-blue-50/50"
              : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
          } ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center py-10">
            <div className={`rounded-full p-3 ${dragActive ? "bg-blue-100" : "bg-slate-100"}`}>
              <Upload className={`h-6 w-6 ${dragActive ? "text-blue-500" : "text-slate-400"}`} />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">
              {dragActive ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="mt-1 text-xs text-slate-400">or click to browse</p>
            <p className="mt-2 text-xs text-slate-400">PDF, JPG, PNG, WEBP — max 10 MB each</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">
                  {totalCount} file{totalCount !== 1 ? "s" : ""}
                </span>
                {doneCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> {doneCount} uploaded
                  </span>
                )}
                {dupCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Copy className="h-3 w-3" /> {dupCount} duplicate{dupCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {!uploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearAll(); }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {files.map((entry) => {
                const Icon = getFileIcon(entry.file.type);
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      entry.status === "failed"
                        ? "border-red-200 bg-red-50/50"
                        : entry.isDuplicate
                        ? "border-amber-200 bg-amber-50/30"
                        : entry.status === "done"
                        ? "border-emerald-200 bg-emerald-50/30"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    {/* Thumbnail / Icon */}
                    <div className="flex-shrink-0">
                      {entry.preview ? (
                        <img
                          src={entry.preview}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100">
                          <Icon className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-700">{entry.file.name}</p>
                        {entry.isDuplicate && (
                          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            <Copy className="h-3 w-3" />
                            Duplicate
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatSize(entry.file.size)}
                        {entry.detail && (
                          <span className="ml-2 text-red-500">{entry.detail}</span>
                        )}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0">
                      {entry.status === "uploading" && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {entry.status === "done" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      {entry.status === "failed" && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      {entry.status === "queued" && !uploading && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(entry.id); }}
                          className="rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload Button */}
        {files.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              {queuedCount > 0
                ? `${queuedCount} file${queuedCount !== 1 ? "s" : ""} ready to upload`
                : "All files processed"}
            </p>
            <button
              onClick={handleUpload}
              disabled={uploading || queuedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {queuedCount > 0 ? `(${queuedCount})` : ""}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer links */}
      <div className="flex gap-2">
        <Link
          href="/documents"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          View Documents
        </Link>
      </div>
    </section>
  );
}
