"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

  const help = useMemo(
    () => (
      <p className="text-xs text-slate-500">
        Shortcut: <kbd className="rounded border px-1">Ctrl/Cmd + K</kbd> or{" "}
        <kbd className="rounded border px-1">/</kbd>
      </p>
    ),
    []
  );

  return (
    <div className="relative">
      <button
        className="rounded border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        Search
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[340px] rounded border bg-white p-3 shadow-lg">
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search documents/vendors/customers..."
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="mt-2">{help}</div>
          {q.trim().length >= 2 && error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <div className="mt-2 max-h-60 overflow-auto text-sm">
            {q.trim().length >= 2
              ? rows.map((row) => (
              <Link
                key={`${row.type}-${row.id}`}
                href={row.type === "document" ? "/documents" : "/settings"}
                className="block rounded px-2 py-1 hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                <span className="font-medium">{row.label || "(no label)"}</span>
                <span className="ml-2 text-xs text-slate-500">{row.type}</span>
              </Link>
                ))
              : null}
            {!rows.length && q.trim().length >= 2 ? (
              <p className="px-2 py-1 text-xs text-slate-500">No results</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

