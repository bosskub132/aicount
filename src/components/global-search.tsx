"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type SearchRow = {
  id: string;
  type: string;
  label: string | null;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
      if (event.key === "/" && !open) {
        const activeTag = (document.activeElement as HTMLElement | null)?.tagName || "";
        if (activeTag !== "INPUT" && activeTag !== "TEXTAREA") {
          event.preventDefault();
          setOpen(true);
        }
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) return;
    const tenantId = getWorkspaceTenantId();
    const timeout = setTimeout(() => {
      fetch(`/api/search?tenantId=${tenantId}&q=${encodeURIComponent(q.trim())}`)
        .then((res) => res.json())
        .then((json) => {
          if (!json.success) throw new Error(json.error || "Search failed");
          setRows((json.data || []) as SearchRow[]);
          setError("");
        })
        .catch((err) => {
          setRows([]);
          setError(err instanceof Error ? err.message : "Search failed");
        });
    }, 250);
    return () => clearTimeout(timeout);
  }, [open, q]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setRows([]);
      setError("");
    }
  }, [open]);

  const help = useMemo(
    () => (
      <p className="text-xs text-[var(--muted-foreground)]">
        Shortcut: <kbd className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--muted)] px-1 py-0.5 text-[11px]">Ctrl/Cmd + K</kbd> or{" "}
        <kbd className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--muted)] px-1 py-0.5 text-[11px]">/</kbd>
      </p>
    ),
    []
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

      {/* Search panel */}
      <div className="relative z-10 w-full max-w-lg rounded-[var(--radius-modal)] bg-white shadow-[var(--shadow-lg)]">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search documents, vendors, customers..."
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {q.trim().length < 2 && (
            <div className="px-2 py-3">{help}</div>
          )}
          {q.trim().length >= 2 && error && (
            <p className="px-2 py-2 text-xs text-[var(--destructive)]">{error}</p>
          )}
          {q.trim().length >= 2 && !error && rows.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-[var(--muted-foreground)]">No results found</p>
          )}
          {q.trim().length >= 2 &&
            !error &&
            rows.map((row) => (
              <Link
                key={`${row.type}-${row.id}`}
                href={row.type === "document" ? "/documents" : "/settings"}
                className="flex items-center gap-2 rounded-[var(--radius-input)] px-2 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
                onClick={() => setOpen(false)}
              >
                <span className="font-medium text-[var(--foreground)]">{row.label || "(no label)"}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{row.type}</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
