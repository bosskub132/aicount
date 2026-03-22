# Phase 2: Core Workflow Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework all core workflow pages (Dashboard, Documents, Extractions, Upload, Export) to use Phase 1 design system, add UX improvements, and merge Approvals/Query Tray into Documents.

**Architecture:** React Query for data fetching (QueryClientProvider in app layout). Recharts for dashboard charts. Side panel pattern for Documents page. All pages consume design system components from `src/components/`. Three minor API additions for pagination, status breakdown, and export history enhancement.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, @tanstack/react-query 5, Recharts 3, Zustand 5, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-23-phase2-core-workflows-design.md`

---

## File Structure

### New Files

```
src/
  components/
    document-side-panel.tsx     # Slide-out document preview panel (Documents page)
    document-image-viewer.tsx   # Zoomable document image/PDF viewer (Extractions page)
    confidence-bar.tsx          # Confidence score bar visualization
    upload-queue.tsx            # Upload queue with per-file status + OCR polling
    status-timeline.tsx         # Document status history timeline
  lib/
    hooks/
      use-documents.ts          # React Query hooks: useDocuments, useDocument, useDocumentMutations
      use-dashboard.ts          # React Query hooks: useMonthlyComparison, useStatusBreakdown
      use-export.ts             # React Query hooks: useTemplates, useExportHistory, useExportMutation
    providers/
      query-provider.tsx        # QueryClientProvider wrapper ("use client")
  app/
    api/
      tenants/[id]/reports/
        status-breakdown/route.ts  # NEW — document counts by status for dashboard donut
```

### Modified Files

```
src/
  components/
    stat-card.tsx               # ADD: optional href prop for clickable cards
    data-table.tsx              # ADD: onRowClick prop
    sidebar.tsx                 # UPDATE: Approvals href → /documents?tab=pending
  app/
    (app)/
      layout.tsx                # WRAP with QueryClientProvider
      dashboard/page.tsx        # REWRITE
      documents/page.tsx        # REWRITE
      extractions/page.tsx      # REWRITE
      upload/page.tsx           # REWRITE
      export/page.tsx           # REWRITE
      approvals/page.tsx        # REPLACE with redirect
      query-tray/page.tsx       # REPLACE with redirect
    api/
      documents/route.ts        # ADD: page, limit, sort, order, search params
      tenants/[id]/reports/
        export-history/route.ts # ENHANCE: add computed totalAmount + recordCount
```

---

## Task 1: React Query Provider Setup

**Files:**
- Create: `src/lib/providers/query-provider.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create QueryClientProvider wrapper**

```tsx
// src/lib/providers/query-provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function AppQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Wrap app layout with provider**

In `src/app/(app)/layout.tsx`, import `AppQueryProvider` and wrap the return JSX:

```tsx
import { AppQueryProvider } from "@/lib/providers/query-provider";

// In the return, wrap everything:
return (
  <AppQueryProvider>
    <div className="flex h-screen bg-[var(--background)]">
      {/* ... existing layout ... */}
    </div>
  </AppQueryProvider>
);
```

- [ ] **Step 3: Verify dev server starts**

Run: `npm run dev`
Expected: No errors, app renders normally.

- [ ] **Step 4: Commit**

```bash
git add src/lib/providers/query-provider.tsx src/app/\(app\)/layout.tsx
git commit -m "feat: add React Query provider to app layout"
```

---

## Task 2: Extend StatCard and DataTable Components

**Files:**
- Modify: `src/components/stat-card.tsx`
- Modify: `src/components/data-table.tsx`

- [ ] **Step 1: Add `href` prop to StatCard**

```tsx
// src/components/stat-card.tsx — add href and wrap in Link when present
import Link from "next/link";

interface StatCardProps {
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  href?: string;
}

export function StatCard({ title, value, trend, trendValue, href }: StatCardProps) {
  const trendColor = trend === "up" ? "text-[var(--success)]" : trend === "down" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const content = (
    <div className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 ${href ? "hover:border-[var(--primary)] hover:shadow-[var(--shadow-sm)] transition-all cursor-pointer" : ""}`}>
      <p className="text-xs text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
      {trendValue && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trendValue}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
```

- [ ] **Step 2: Add `onRowClick` prop to DataTable**

In `src/components/data-table.tsx`, add to the `DataTableProps` interface:

```tsx
onRowClick?: (row: T) => void;
```

In the `<tr>` rendering for data rows, add:

```tsx
<tr
  key={String(row[keyField])}
  onClick={() => onRowClick?.(row)}
  className={`border-b border-[var(--border)] ${onRowClick ? "cursor-pointer hover:bg-[var(--primary-light)]" : "hover:bg-[var(--muted)]"} transition-colors`}
>
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/stat-card.tsx src/components/data-table.tsx
git commit -m "feat: add href to StatCard, onRowClick to DataTable"
```

---

## Task 3: Backend — Documents Pagination + Status Breakdown API

**Files:**
- Modify: `src/app/api/documents/route.ts`
- Create: `src/app/api/tenants/[id]/reports/status-breakdown/route.ts`

- [ ] **Step 1: Add pagination, sorting, search to documents list API**

Replace the GET handler in `src/app/api/documents/route.ts` with:

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const sortField = searchParams.get("sort") || "createdAt";
    const sortOrder = searchParams.get("order") === "asc" ? "asc" : "desc";
    const search = searchParams.get("search")?.trim();

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }

    // Build where conditions
    const conditions = [eq(documents.tenantId, tenantId)];
    if (status) conditions.push(eq(documents.status, status as any));
    if (search) {
      conditions.push(
        or(
          ilike(documents.issuerName, `%${search}%`),
          ilike(documents.documentNumber, `%${search}%`)
        )!
      );
    }
    const where = and(...conditions);

    // Sort column mapping
    const sortColumns: Record<string, any> = {
      createdAt: documents.createdAt,
      issuerName: documents.issuerName,
      grandTotal: documents.grandTotal,
      documentDate: documents.documentDate,
      status: documents.status,
    };
    const sortCol = sortColumns[sortField] || documents.createdAt;
    const orderFn = sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

    // Count total
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(documents)
      .where(where);

    // Fetch page
    const offset = (page - 1) * limit;
    const rows = await db
      .select()
      .from(documents)
      .where(where)
      .orderBy(orderFn)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "List failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create status-breakdown endpoint**

```tsx
// src/app/api/tenants/[id]/reports/status-breakdown/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const rows = await db
    .select({
      status: documents.status,
      count: sql<number>`count(*)::int`,
    })
    .from(documents)
    .where(and(eq(documents.tenantId, id), isNull(documents.deletedAt)))
    .groupBy(documents.status);

  return NextResponse.json({ success: true, data: rows });
}
```

- [ ] **Step 3: Verify both endpoints work**

Run: `npm run dev`
Test: `curl "http://localhost:3000/api/documents?tenantId=...&page=1&limit=5"`
Expected: Paginated response with `meta` field.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/documents/route.ts src/app/api/tenants/\[id\]/reports/status-breakdown/route.ts
git commit -m "feat: add pagination to documents API, create status-breakdown endpoint"
```

---

## Task 3b: Backend — Enhance Export History Endpoint

**Files:**
- Modify: `src/app/api/tenants/[id]/reports/export-history/route.ts`

- [ ] **Step 1: Enhance export-history to include computed totalAmount and recordCount**

Read the existing `src/app/api/tenants/[id]/reports/export-history/route.ts`. The `exportTemplateSelections` table stores `documentIds` as a JSON array. Enhance the query to:

1. Return `recordCount` as the length of the `documentIds` array
2. Compute `totalAmount` by joining against the `documents` table and summing `grandTotal` for the document IDs in each selection
3. Add a `templateName` by joining against `exportTemplates`

If the join is too complex, compute `recordCount` from `json_array_length(documentIds)` and skip `totalAmount` (the History tab can show record count without amount).

- [ ] **Step 2: Verify endpoint returns enhanced data**

Run: `npm run dev`
Test endpoint returns `recordCount` field.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tenants/\[id\]/reports/export-history/route.ts
git commit -m "feat: enhance export-history endpoint with recordCount"
```

---

## Task 4: React Query Hooks

**Files:**
- Create: `src/lib/hooks/use-documents.ts`
- Create: `src/lib/hooks/use-dashboard.ts`
- Create: `src/lib/hooks/use-export.ts`

- [ ] **Step 1: Create documents hooks**

```tsx
// src/lib/hooks/use-documents.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface DocumentsParams {
  status?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
}

export function useDocuments(params: DocumentsParams = {}) {
  const tenantId = getWorkspaceTenantId();
  const { status, page = 1, limit = 20, sort = "createdAt", order = "desc", search } = params;

  return useQuery({
    queryKey: ["documents", tenantId, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ tenantId, page: String(page), limit: String(limit), sort, order });
      if (status) sp.set("status", status);
      if (search) sp.set("search", search);
      const res = await fetch(`/api/documents?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch documents");
      return json;
    },
    enabled: !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
  });
}

export function useDocument(id: string | null) {
  return useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!id,
  });
}

export function useDocumentMutations() {
  const queryClient = useQueryClient();
  const tenantId = getWorkspaceTenantId();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["document"] });
  };

  const submit = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async ({ docId, comment }: { docId: string; comment: string }) => {
      const res = await fetch(`/api/documents/${docId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, comment }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: invalidate,
  });

  const reOcr = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/re-ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: invalidate,
  });

  return { submit, approve, reject, reOcr };
}
```

- [ ] **Step 2: Create dashboard hooks**

```tsx
// src/lib/hooks/use-dashboard.ts
import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

const isValidTenant = (id: string) => !!id && id !== "00000000-0000-0000-0000-000000000000";

export function useMonthlyComparison(months = 6) {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["monthly-comparison", tenantId, months],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/monthly-comparison?months=${months}`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: isValidTenant(tenantId),
  });
}

export function useStatusBreakdown() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["status-breakdown", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/status-breakdown`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: isValidTenant(tenantId),
  });
}

export function useApprovalQueue() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["approval-queue", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/approval-queue?tenantId=${tenantId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: isValidTenant(tenantId),
  });
}
```

- [ ] **Step 3: Create export hooks**

```tsx
// src/lib/hooks/use-export.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export function useExportTemplates() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["export-templates", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/export/templates?tenantId=${tenantId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
  });
}

export function useExportHistory() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["export-history", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/export-history`, {
        headers: { "x-tenant-id": tenantId },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
  });
}

export function useExportMutation() {
  return useMutation({
    mutationFn: async (payload: {
      tenantId: string;
      templateId: string;
      selectedDocumentIds: string[];
      exportMode: string;
      period?: string;
      journalType?: string;
    }) => {
      const res = await fetch("/api/export/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, returnContent: false }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/
git commit -m "feat: add React Query hooks for documents, dashboard, export"
```

---

## Task 5: Shared Components — Side Panel, Image Viewer, Confidence Bar

**Files:**
- Create: `src/components/document-side-panel.tsx`
- Create: `src/components/document-image-viewer.tsx`
- Create: `src/components/confidence-bar.tsx`
- Create: `src/components/status-timeline.tsx`
- Create: `src/components/upload-queue.tsx`

These are substantial components. Each has its own subtask below.

- [ ] **Step 1: Create confidence-bar.tsx**

```tsx
// src/components/confidence-bar.tsx
interface ConfidenceBarProps {
  score: number; // 0-1 or 0-100
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ConfidenceBar({ score, size = "md", showLabel = true }: ConfidenceBarProps) {
  const normalized = score > 1 ? score / 100 : score;
  const percent = Math.round(normalized * 100);
  const color =
    normalized >= 0.8
      ? "bg-[var(--success)]"
      : normalized >= 0.5
        ? "bg-[var(--warning)]"
        : "bg-[var(--destructive)]";
  const textColor =
    normalized >= 0.8
      ? "text-[var(--success)]"
      : normalized >= 0.5
        ? "text-[var(--warning)]"
        : "text-[var(--destructive)]";
  const h = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} rounded-full bg-[var(--muted)] overflow-hidden`}>
        <div className={`${h} rounded-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      {showLabel && <span className={`text-xs font-medium tabular-nums ${textColor}`}>{percent}%</span>}
    </div>
  );
}
```

- [ ] **Step 2: Create status-timeline.tsx**

```tsx
// src/components/status-timeline.tsx
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface TimelineEntry {
  status: string;
  timestamp: string;
  label?: string;
}

interface StatusTimelineProps {
  entries: TimelineEntry[];
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  APPROVED: CheckCircle2,
  EXPORTED: CheckCircle2,
  REJECTED: AlertTriangle,
};

export function StatusTimeline({ entries }: StatusTimelineProps) {
  return (
    <div className="flex flex-col gap-0">
      {entries.map((entry, i) => {
        const Icon = statusIcons[entry.status] || Clock;
        const isLast = i === entries.length - 1;
        return (
          <div key={`${entry.status}-${entry.timestamp}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Icon className={`h-4 w-4 ${isLast ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
              {!isLast && <div className="w-px flex-1 bg-[var(--border)]" />}
            </div>
            <div className="pb-3">
              <p className={`text-xs font-medium ${isLast ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
                {entry.label || entry.status.replace(/_/g, " ")}
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {new Date(entry.timestamp).toLocaleString("th-TH")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create document-image-viewer.tsx**

```tsx
// src/components/document-image-viewer.tsx
"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";
import { Button } from "@/components/button";

interface DocumentImageViewerProps {
  src: string;
  alt?: string;
}

export function DocumentImageViewer({ src, alt = "Document" }: DocumentImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf = src.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))} icon={<ZoomIn className="h-4 w-4" />}>Zoom In</Button>
        <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} icon={<ZoomOut className="h-4 w-4" />}>Zoom Out</Button>
        <Button variant="ghost" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)} icon={<RotateCw className="h-4 w-4" />}>Rotate</Button>
        <div className="flex-1" />
        <a href={src} download className="inline-flex">
          <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />}>Download</Button>
        </a>
      </div>
      {/* Viewer */}
      <div className="flex-1 overflow-auto bg-[var(--muted)] flex items-center justify-center p-4">
        {isPdf ? (
          <iframe src={src} className="w-full h-full border-0 rounded-[var(--radius-card)]" title={alt} />
        ) : (
          <img
            src={src}
            alt={alt}
            className="max-w-full transition-transform duration-200"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create document-side-panel.tsx**

```tsx
// src/components/document-side-panel.tsx
"use client";

import { X } from "lucide-react";
import { useDocument } from "@/lib/hooks/use-documents";
import { ConfidenceBar } from "@/components/confidence-bar";
import { StatusBadge } from "@/components/badge";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/skeleton";

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
            {doc.fileUrl && (
              <div className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--border)] bg-[var(--muted)] h-48 flex items-center justify-center">
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
```

- [ ] **Step 5: Create upload-queue.tsx**

```tsx
// src/components/upload-queue.tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, FileText, AlertTriangle, X } from "lucide-react";
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
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/components/confidence-bar.tsx src/components/status-timeline.tsx src/components/document-image-viewer.tsx src/components/document-side-panel.tsx src/components/upload-queue.tsx
git commit -m "feat: add shared components for Phase 2 pages"
```

---

## Task 6: Page Redirects + Sidebar Update

**Files:**
- Modify: `src/app/(app)/approvals/page.tsx`
- Modify: `src/app/(app)/query-tray/page.tsx`
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Replace approvals page with redirect**

```tsx
// src/app/(app)/approvals/page.tsx
import { redirect } from "next/navigation";

export default function ApprovalsPage() {
  redirect("/documents?tab=pending");
}
```

- [ ] **Step 2: Replace query-tray page with redirect**

```tsx
// src/app/(app)/query-tray/page.tsx
import { redirect } from "next/navigation";

export default function QueryTrayPage() {
  redirect("/documents?tab=query");
}
```

- [ ] **Step 3: Update sidebar Approvals link**

In `src/components/sidebar.tsx`, change the Approvals nav item href:
```tsx
// In the DOCUMENTS group items array, change:
{ href: "/approvals", label: "Approvals", icon: CheckCircle2 },
// To:
{ href: "/documents?tab=pending", label: "Approvals", icon: CheckCircle2 },
```

- [ ] **Step 4: Verify redirects work**

Run: `npm run dev`
Navigate to `/approvals` → should redirect to `/documents?tab=pending`
Navigate to `/query-tray` → should redirect to `/documents?tab=query`

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/approvals/page.tsx src/app/\(app\)/query-tray/page.tsx src/components/sidebar.tsx
git commit -m "feat: merge Approvals and Query Tray into Documents page via redirects"
```

---

## Task 7: Documents Page — Full Rework

**Files:**
- Rewrite: `src/app/(app)/documents/page.tsx`

This is the largest task. The page uses DataTable + Tabs + side panel + bulk actions.

- [ ] **Step 1: Rewrite documents page**

Read the current `src/app/(app)/documents/page.tsx` (711 lines) to understand the existing status handling, action logic, and role-based permissions. Then rewrite with this structure:

**Imports and constants:**
```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDocuments, useDocumentMutations } from "@/lib/hooks/use-documents";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { Tabs } from "@/components/tabs";
import { DataTable, type Column } from "@/components/data-table";
import { DocumentSidePanel } from "@/components/document-side-panel";
import { Pagination } from "@/components/pagination";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import { StatusBadge, Badge } from "@/components/badge";
import { Modal } from "@/components/modal";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { FileText, Search } from "lucide-react";

// Note: StatusBadge lives in badge.tsx alongside Badge (not a separate file)

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "action", label: "Action Required", filterStatuses: ["DRAFT", "OCR_PROCESSING", "ACTION_REQUIRED"] },
  { id: "query", label: "Query", filterStatuses: ["QUERY"] },
  { id: "pending", label: "Pending", filterStatuses: ["PENDING_APPROVAL"] },
  { id: "approved", label: "Approved", filterStatuses: ["APPROVED", "EXPORTED"] },
  { id: "rejected", label: "Rejected", filterStatuses: ["REJECTED"] },
  { id: "void", label: "Void", filterStatuses: ["VOID"] },
];
```

**Top-level state variables:**
```tsx
export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const tenantId = getWorkspaceTenantId();

  // Tab from URL — defaults to "all"
  const initialTab = searchParams.get("tab") || "all";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Pagination + search
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Side panel
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ docId: string } | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  // Role-based permissions
  const [permissions, setPermissions] = useState({ canSubmit: false, canApprove: false });
```

**Data fetching:**
```tsx
  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Map tab to status filter
  const statusFilter = useMemo(() => {
    const tab = STATUS_TABS.find((t) => t.id === activeTab);
    return tab?.filterStatuses?.join(",") || undefined;
  }, [activeTab]);

  const { data, isLoading } = useDocuments({
    status: statusFilter,
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });

  const { submit, approve, reject, reOcr } = useDocumentMutations();
```

**DataTable column definitions:**
```tsx
  const columns: Column<any>[] = [
    { key: "issuerName", header: "Issuer", render: (row) => row.issuerName || "—" },
    { key: "documentNumber", header: "Doc No.", render: (row) => row.documentNumber || "—" },
    {
      key: "grandTotal", header: "Amount", align: "right",
      render: (row) => row.grandTotal ? `฿${Number(row.grandTotal).toLocaleString()}` : "—",
    },
    {
      key: "direction", header: "Direction",
      render: (row) => row.direction ? <Badge variant={row.direction === "REVENUE" ? "approved" : "action_required"}>{row.direction}</Badge> : "—",
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "documentDate", header: "Date",
      render: (row) => row.documentDate ? new Date(row.documentDate).toLocaleDateString("th-TH") : "—",
    },
  ];
```

**Event handlers:**
```tsx
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setPage(1);
    setSelectedDocId(null);
    setSelectedIds([]);
    router.push(`/documents?tab=${tabId}`, { scroll: false });
  };

  const handleRowClick = (row: any) => {
    setSelectedDocId(row.id === selectedDocId ? null : row.id);
  };

  const handleAction = async (action: string, docId: string) => {
    try {
      if (action === "edit") router.push(`/extractions?docId=${docId}`);
      else if (action === "submit") { await submit.mutateAsync(docId); toast.success("Submitted for approval"); }
      else if (action === "approve") { await approve.mutateAsync(docId); toast.success("Document approved"); }
      else if (action === "reject") setRejectModal({ docId });
      else if (action === "re-ocr") { await reOcr.mutateAsync(docId); toast.info("Re-processing OCR..."); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };
```

**Render structure:**
```tsx
  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header: title + search */}
        {/* Tabs with count badges */}
        {/* DataTable or loading/empty states */}
        {/* Pagination */}
        {/* Bulk actions bar (when selectedIds.length > 0) */}
      </div>
      {/* Side panel */}
      <DocumentSidePanel
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onAction={handleAction}
      />
      {/* Reject comment modal */}
    </div>
  );
}
```

Fill in the JSX body using the components listed above. The render should be ~150 lines of JSX. Fetch workspace role on mount with `GET /api/auth/workspace-role?tenantId={tenantId}` to populate `permissions` state.

- [ ] **Step 2: Verify page renders with data**

Run: `npm run dev`
Navigate to `/documents`
Expected: DataTable with tabs, pagination, search. Click row → side panel opens.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/documents/page.tsx
git commit -m "feat: rework Documents page with DataTable, side panel, pagination"
```

---

## Task 8: Upload Page — Rework with Live OCR Status

**Files:**
- Rewrite: `src/app/(app)/upload/page.tsx`

- [ ] **Step 1: Rewrite upload page**

Read current `src/app/(app)/upload/page.tsx` (336 lines). Rewrite using:

- Drag-and-drop zone styled with design tokens (dashed border, active state)
- `UploadQueue` component for per-file status
- After upload completes, poll `GET /api/documents/{id}` every 3s until status changes from `OCR_PROCESSING`
- Show extracted fields preview when done (issuerName, grandTotal)
- `useToast()` for upload success/failure notifications
- `Card`, `Button`, `Badge` components
- `EmptyState` when no files queued

Key behavior:
- Files added via drag-drop or click → queued
- Upload starts immediately for all queued files via `POST /api/documents/upload-batch`
- Each file tracks: queued → uploading → uploaded → processing → done/failed
- Polling uses `setInterval` with cleanup, not React Query (transient upload state)

- [ ] **Step 2: Verify upload flow end-to-end**

Run: `npm run dev`
Upload a file → should show uploading progress → uploaded → processing → done with extracted fields.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/upload/page.tsx
git commit -m "feat: rework Upload page with live OCR status tracking"
```

---

## Task 9: Dashboard Page — Full Rework with Charts

**Files:**
- Rewrite: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Rewrite dashboard page**

Read current `src/app/(app)/dashboard/page.tsx` (188 lines). Rewrite using:

- `Tabs` component with 3 tabs: Summary, Pipeline, Action Items
- **Summary tab:**
  - 4 `StatCard` components in a grid (pending count with href, queries count with href, revenue total, expense total)
  - Recharts `LineChart` for revenue vs expense (6 months)
  - Recharts `PieChart` (donut) for document status breakdown
  - `DataTable` for recent activity (last 10 docs)
- **Pipeline tab:**
  - Recharts `BarChart` for documents processed per week
  - `StatCard` for average processing time
  - Status funnel visualization (can be a horizontal bar chart or custom SVG)
- **Action Items tab:**
  - `DataTable` of pending approvals with inline Approve button
  - `DataTable` of QUERY documents with Re-OCR button
  - `Card` listing stuck ACTION_REQUIRED docs (>3 days)

Use `useMonthlyComparison()`, `useStatusBreakdown()`, `useDocuments()` hooks.

Recharts colors should use CSS variable values:
```tsx
const CHART_COLORS = {
  revenue: "#059669", // var(--success)
  expense: "#DC2626", // var(--destructive)
  primary: "#2563EB", // var(--primary)
};
```

- [ ] **Step 2: Verify dashboard renders with data**

Run: `npm run dev`
Navigate to `/dashboard`
Expected: Stat cards, charts, and tables render. Tabs switch content.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: rework Dashboard with tabbed layout, Recharts, and action items"
```

---

## Task 10: Extractions Page — Full Rework

**Files:**
- Rewrite: `src/app/(app)/extractions/page.tsx`

- [ ] **Step 1: Rewrite extractions page**

Read current `src/app/(app)/extractions/page.tsx` (400+ lines). Rewrite as a two-column layout using:

- `Breadcrumbs` component: `[{ label: "Documents", href: "/documents" }, { label: "${issuerName} — ${docNumber}" }]`
- Left column (~40%): `DocumentImageViewer` component
- Right column (~60%, scrollable):
  - `ConfidenceBar` at top
  - Collapsible sections using `<details>` elements:
    - Issuer Information (4 fields)
    - Transaction Details (4 fields)
    - Pricing & VAT (4 fields)
    - Line Items (editable table)
    - Journal Entries (read-only, auto-generated)
    - Raw OCR JSON (collapsed by default)
  - All fields use `Input` and `Select` components
  - Per-field confidence indicators using small `ConfidenceBar` with `size="sm"`
- Bottom action bar: Save Draft + Submit for Approval buttons
- `useDocument()` hook for data fetching
- `useToast()` for save/submit feedback
- Client-side undo: track previous field values in state, restore on Ctrl+Z
- "Revert" button calls `POST /api/documents/{id}/undo`

- [ ] **Step 2: Verify extractions page**

Run: `npm run dev`
Navigate to `/extractions?docId=...` with a valid document ID.
Expected: Two-column layout with image viewer and editable fields.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/extractions/page.tsx
git commit -m "feat: rework Extractions page with two-column editing layout"
```

---

## Task 11: Export Page — Rework with History + Preview

**Files:**
- Rewrite: `src/app/(app)/export/page.tsx`

- [ ] **Step 1: Rewrite export page**

Read current `src/app/(app)/export/page.tsx` (317 lines). Rewrite using:

- `Tabs` with 2 tabs: Export, History
- **Export tab:**
  - Template cards using `Card` component, grouped by direction
  - `DataTable` for document selection with tabs for match strength
  - `RadioGroup` for export mode (Document Level / Item Level)
  - Summary stats using `StatCard` (records, total, date range)
  - "Preview" button opens `Modal` with summary table of selected documents
  - "Download" button triggers export + file download
- **History tab:**
  - `DataTable` showing past exports from `useExportHistory()`
  - Columns: Date, Template, Records, Total Amount, Re-download button
- Use `useExportTemplates()`, `useExportHistory()`, `useExportMutation()` hooks
- `useToast()` for export success/failure

- [ ] **Step 2: Verify export flow**

Run: `npm run dev`
Navigate to `/export`
Expected: Template cards, document table, history tab.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/export/page.tsx
git commit -m "feat: rework Export page with history tab and preview modal"
```

---

## Task 12: Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual smoke test**

Navigate through all pages:
- `/dashboard` — tabs work, charts render
- `/documents` — table, pagination, side panel, tab filtering
- `/documents?tab=pending` — pre-selects Pending tab
- `/extractions?docId=...` — two-column layout, editable fields
- `/upload` — drag-drop, upload flow
- `/export` — template selection, history tab
- `/approvals` — redirects to `/documents?tab=pending`
- `/query-tray` — redirects to `/documents?tab=query`

- [ ] **Step 4: Commit any remaining changes**

Stage only specific changed files (do not use `git add -A`). Review `git status` and add each modified file explicitly.
