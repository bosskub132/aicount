# Phase 2: Core Workflow Pages — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Depends on:** Phase 1 Design System (completed)
**Scope:** Full rework of 5 core workflow pages + 2 page mergers + shared improvements

---

## Overview

Rework all core workflow pages to use the Phase 1 design system components, redesign page layouts, add missing UX features, and consolidate redundant pages. Primarily a frontend rework, with 3 minor backend additions documented in Section 9.

---

## Page Inventory

| Page | Action | Route |
|------|--------|-------|
| Dashboard | Full rework | `/dashboard` |
| Documents | Full rework + absorb Approvals & Query Tray | `/documents` |
| Extractions | Full rework | `/extractions?docId={id}` |
| Upload | Restyle + live OCR status | `/upload` |
| Export | Restyle + history + preview | `/export` |
| Approvals | **Remove** — merged into Documents | `/approvals` → redirect to `/documents?tab=pending` |
| Query Tray | **Remove** — merged into Documents | `/query-tray` → redirect to `/documents?tab=query` |

---

## 1. Dashboard (`/dashboard`)

### Layout

Tabbed dashboard with 3 tabs:

**Tab 1: Summary (default)** — Priority actionable information first, then charts.

```
┌─────────────────────────────────────────────────────┐
│ [Summary]  [Pipeline]  [Action Items]               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Pending  │ │Queries  │ │Revenue  │ │Expense  │  │
│  │Approvals│ │to Fix   │ │(6 mo)   │ │(6 mo)   │  │
│  │  5 ⚠    │ │  2 ⚠    │ │ ฿1.2M ↑│ │ ฿840K ↓│  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                     │
│  ┌──────────────────────┐ ┌──────────────────────┐  │
│  │ Revenue vs Expense   │ │ Document Status      │  │
│  │ (Line chart, 6 mo)  │ │ (Donut chart)        │  │
│  │                      │ │                      │  │
│  └──────────────────────┘ └──────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Recent Activity (last 10 documents)          │   │
│  │ Issuer | Amount | Status | Date              │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

- **Stat cards (top row):** Pending Approvals count (clickable → Documents pending tab), Queries count (clickable → Documents query tab), Revenue total (6 months), Expense total (6 months). Use `StatCard` component with trend arrows.
- **Charts (middle row):** Revenue vs Expense line chart (Recharts `LineChart`, 6-month rolling) + Document status breakdown donut (Recharts `PieChart`).
- **Recent Activity (bottom):** Last 10 documents in a `DataTable` with status badges. Clickable rows → Documents side panel.

**Tab 2: Pipeline**

- Documents processed per day/week (bar chart — computed from `createdAt` grouping)
- OCR confidence distribution (line chart — uses existing `confidenceScore` field, averaged per week)
- Average time from upload to approval (stat card — computed from `createdAt` vs `approvedAt` where both exist)
- Status funnel: Draft → Processing → Action Required → Pending → Approved → Exported (horizontal funnel — computed from status-breakdown endpoint)
- **Note:** No `ocrStartedAt`/`ocrCompletedAt` timestamps exist. "Processing time" is approximated from `createdAt` to first status change via `updatedAt`.

**Tab 3: Action Items**

- Pending approvals list with quick-approve actions
- Query items needing attention with re-OCR button
- Documents stuck in ACTION_REQUIRED for >3 days (filtered by `updatedAt < now - 3 days` client-side from existing `/api/documents` response)
- Period lock deadlines (upcoming month-end dates)

### Components Used

`Tabs`, `StatCard`, `Card`, `DataTable`, `Badge`, `StatusBadge`, `Skeleton`, `EmptyState`, `Button`

### API Endpoints

- `GET /api/tenants/{id}/reports/monthly-comparison?months=6` (existing)
- `GET /api/documents?tenantId={id}` (existing, for status breakdown + recent activity)
- `GET /api/documents/approval-queue?tenantId={id}` (existing, for pending count)

### New Dependencies

- `recharts` (already in package.json)

---

## 2. Documents (`/documents`)

### Layout

DataTable with a slide-out side panel on the right.

```
┌─────────────────────────────────────────────────────────────┐
│ All Documents                                    [Search] [Filter] │
├─────────────────────────────────────────────────────────────┤
│ [All (47)] [Action (3)] [Query (2)] [Pending (12)] [Approved (28)] [Rejected (2)] [Void (0)] │
├───────────────────────────────────┬─────────────────────────┤
│                                   │                         │
│  ☐ │ Issuer    │ Amount  │ Status │  บจก. สยาม             │
│  ──┼───────────┼─────────┼────────│                         │
│  ☐ │ บจก.สยาม │ ฿45,200 │ Draft  │  ┌─────────────────┐   │
│  ☐ │ Watsadu  │ ฿12,800 │Pending │  │  Doc Preview     │   │
│  ☐ │ Lotus's  │  ฿8,400 │Approved│  │  (image/PDF)     │   │
│  ☐ │ CP Extra │  ฿3,200 │ Query  │  └─────────────────┘   │
│  ☐ │ The Mall │ ฿15,600 │Exported│                         │
│                                   │  Issuer: บจก. สยาม     │
│  ─────────────────────────────────│  Tax ID: 0105548123456 │
│  < 1 2 3 ... 5 >   20/page       │  Amount: ฿45,200.00    │
│                                   │  Date: 15 Mar 2026     │
│                                   │  Confidence: 92%       │
│                                   │                         │
│                                   │  [Edit Details]        │
│                                   │  [Submit] [Approve]    │
│                                   │  [Reject] [Re-OCR]     │
├───────────────────────────────────┴─────────────────────────┤
│ Bulk: [Approve Selected (3)] [Move to Export →]             │
└─────────────────────────────────────────────────────────────┘
```

### Table Features

- **Columns:** Checkbox, Issuer Name, Document Number, Amount (tabular-nums), Direction (Revenue/Expense badge), Status (StatusBadge), Date, Actions (dropdown menu)
- **Sorting:** Click column headers to sort (issuer, amount, date, status)
- **Pagination:** 20 per page default, configurable (10/20/50)
- **Search:** Debounced search by issuer name, document number
- **Tab filtering:** Each tab shows count badge. Clicking tab filters the table.
- **Bulk actions:** Select multiple → bulk approve (shown in bottom bar when selection > 0). "Move to Export" navigates to Export page with pre-selected document IDs as query params.
- **Row click:** Opens side panel for that document

### Side Panel

- **Width:** ~400px, slides in from right with transition
- **Header:** Document title + close button
- **Content (read-only):**
  - Document image/PDF preview (thumbnail, click to enlarge)
  - Key extracted fields (issuer, tax ID, amount, VAT, date, confidence score)
  - Status with full history (created → processing → current)
  - Rejection history (if any)
- **Actions (context-sensitive by status):**
  - DRAFT: Edit Details (→ Extractions), Submit for Approval
  - QUERY: Re-process OCR, Edit Details
  - ACTION_REQUIRED: Edit Details, Submit for Approval
  - PENDING_APPROVAL: Approve, Reject (with comment modal)
  - APPROVED: Export
  - EXPORTED: View export, Create Reversal
  - REJECTED: Edit Details, Re-submit
  - VOID: View only (no actions — voided documents are read-only)

### Merged Pages

- **Approvals:** "Pending" tab pre-selects when navigating from sidebar Approvals link. Approve/Reject actions in side panel.
- **Query Tray:** "Query" tab pre-selects. Re-OCR action in side panel.
- **URL:** `/documents?tab=pending`, `/documents?tab=query` for direct linking

### Sidebar Navigation Update

Change "Approvals" nav item to link to `/documents?tab=pending` instead of `/approvals`.
Remove Query Tray from page title map (it's not in sidebar already).

### Components Used

`DataTable`, `Tabs`, `StatusBadge`, `Badge`, `Button`, `Input`, `Select`, `Pagination`, `Skeleton`, `EmptyState`, `Modal`, `DropdownMenu`, `Toast`

### API Endpoints

- `GET /api/documents?tenantId={id}&status={status}` (existing)
- `GET /api/documents/{id}` (existing, for side panel detail)
- `POST /api/documents/{id}/submit` (existing)
- `POST /api/documents/{id}/approve` (existing)
- `POST /api/documents/{id}/reject` (existing)
- `POST /api/documents/{id}/re-ocr` (existing)
- `GET /api/auth/workspace-role?tenantId={id}` (existing, for permission checks)

### New API Needed

- `GET /api/documents?tenantId={id}&page={n}&limit={n}&sort={field}&order={asc|desc}&search={q}` — Add pagination, sorting, search params to existing endpoint. Currently returns all docs.

---

## 3. Extractions (`/extractions?docId={id}`)

### Layout

Two-column layout: document image on the left, editable fields on the right.

```
┌─────────────────────────────────────────────────────────────┐
│ ← Documents  ›  บจก. สยาม — INV-2026-0342                  │
│                                          [Save] [Submit]    │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   ┌──────────────────┐   │  Confidence: ████████░░ 92%      │
│   │                  │   │                                  │
│   │  Document Image  │   │  ▾ Issuer Information            │
│   │  (zoomable,      │   │    Company: [บจก. สยาม        ]  │
│   │   scrollable)    │   │    Tax ID:  [0105548123456    ]  │
│   │                  │   │    Branch:  [Head Office      ]  │
│   │                  │   │    Address: [123 Sukhumvit    ]  │
│   │                  │   │                                  │
│   │                  │   │  ▾ Transaction Details            │
│   │                  │   │    Doc No:  [INV-2026-0342    ]  │
│   │                  │   │    Date:    [15/03/2026       ]  │
│   │                  │   │    Type:    [Invoice      ▾   ]  │
│   │                  │   │    Direction:[Expense     ▾   ]  │
│   │                  │   │                                  │
│   └──────────────────┘   │  ▾ Pricing & VAT                 │
│                          │    Subtotal: [฿42,242.99      ]  │
│   [Zoom In] [Zoom Out]  │    VAT 7%:   [฿2,957.01       ]  │
│   [Rotate] [Download]   │    Grand:    [฿45,200.00      ]  │
│                          │    WHT:      [฿0.00           ]  │
│                          │                                  │
│                          │  ▾ Line Items (3)                │
│                          │    ┌──────────────────────────┐  │
│                          │    │ Desc  │ Qty │ Price │ Tot│  │
│                          │    │───────┼─────┼───────┼────│  │
│                          │    │ Item1 │  2  │ ฿500  │฿1K │  │
│                          │    │ Item2 │  1  │ ฿200  │฿200│  │
│                          │    │ [+ Add Line Item]        │  │
│                          │    └──────────────────────────┘  │
│                          │                                  │
│                          │  ▾ Journal Entries (auto)        │
│                          │    DR: 510100 ฿42,242.99         │
│                          │    DR: 110710 ฿2,957.01          │
│                          │    CR: 210100 ฿45,200.00         │
│                          │                                  │
│                          │  ▸ Raw OCR JSON                  │
├──────────────────────────┴──────────────────────────────────┤
│                     [Save Draft]  [Submit for Approval]     │
└─────────────────────────────────────────────────────────────┘
```

### Features

- **Breadcrumb:** `<Breadcrumbs items={[{ label: "Documents", href: "/documents" }, { label: "${issuerName} — ${docNumber}" }]} />`
- **Document image panel (left, ~40% width):**
  - Renders uploaded image/PDF
  - Zoom in/out controls
  - Rotate button
  - Download original button
  - Click-to-zoom lightbox
- **Fields panel (right, ~60% width, scrollable):**
  - Overall confidence bar at top
  - Per-field confidence indicators (small colored dots: green/amber/red)
  - Collapsible sections: Issuer Info, Transaction Details, Pricing & VAT, Line Items, Journal Entries, Raw OCR JSON
  - All fields editable with `Input`, `Select` components
  - Line items: editable table with add/delete rows
  - Journal entries: auto-generated from extracted data, read-only (recalculates on field change)
- **Actions:**
  - Save Draft — persists without status change
  - Submit for Approval — validates required fields, moves to PENDING_APPROVAL
  - Cancel — returns to Documents page
- **Period lock:** If document month is locked, show warning banner and disable editing (admin override available)
- **Undo:** Two levels: (1) Client-side in-memory undo for unsaved edits (Ctrl+Z style, revert field to previous value before save), (2) "Revert to previous version" button calls existing `POST /api/documents/{id}/undo` endpoint to restore last saved state from `ocrRaw.undoHistory`

### Components Used

`Breadcrumbs`, `Card`, `Input`, `Select`, `Button`, `Badge`, `Skeleton`, `Toast`, `Modal` (for confirmation dialogs)

### API Endpoints

- `GET /api/documents/{id}` (existing)
- `PATCH /api/documents/{id}` (existing)
- `POST /api/documents/{id}/submit` (existing)

---

## 4. Upload (`/upload`)

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Upload Documents                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │     📄 Drag & drop files here                 │  │
│  │     or click to browse                        │  │
│  │                                               │  │
│  │     PDF, JPG, PNG, WEBP · Max 10MB each       │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Upload Queue (3 files)                [Clear All]  │
│  ┌───────────────────────────────────────────────┐  │
│  │ ✓ invoice-001.pdf    1.2MB   Uploaded         │  │
│  │   ⟳ Processing OCR...  ████░░░░ 60%          │  │
│  │   → Issuer: บจก. สยาม  Amount: ฿45,200       │  │
│  │   [View in Documents]                         │  │
│  ├───────────────────────────────────────────────┤  │
│  │ ✓ receipt-002.jpg    800KB   Uploaded         │  │
│  │   ⟳ Processing OCR...  ██░░░░░░ 25%          │  │
│  ├───────────────────────────────────────────────┤  │
│  │ ↑ receipt-003.png    2.1MB   Uploading...     │  │
│  │   ████████░░ 80%                              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Recently Uploaded (completed OCR)             │  │
│  │ ┌────────────────────────────────────────┐    │  │
│  │ │ Issuer   │ Amount  │ Status │ Action   │    │  │
│  │ │ บจก.ABC │ ฿12,000 │ Draft  │ [Review] │    │  │
│  │ └────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Features

- **Drag & drop zone:** Styled with design tokens, drag-active state
- **Upload queue:** Per-file status tracking:
  - Queued → Uploading (progress bar) → Uploaded → OCR Processing (polling) → Done (extracted fields preview)
  - Failed state with retry button
  - Duplicate detection badge (amber warning)
  - Remove individual files from queue
- **Live OCR status:** After upload completes, poll `/api/documents/{id}` every 3 seconds until status changes from OCR_PROCESSING. Show:
  - Spinner during processing
  - Extracted key fields when done (issuer, amount)
  - Link to view in Documents / edit in Extractions
- **Recently uploaded:** Table showing batch results with links to review
- **Toast notifications:** Upload success, upload failure, OCR complete

### Components Used

`Card`, `Button`, `Badge`, `Skeleton`, `Toast`, `DataTable` (for recently uploaded)

### API Endpoints

- `POST /api/documents/upload-batch` (existing)
- `GET /api/documents/{id}` (existing, for polling OCR status)

---

## 5. Export (`/export`)

### Layout

Three tabs: Export, History, Preview.

```
┌─────────────────────────────────────────────────────┐
│ Export to Express                                     │
├─────────────────────────────────────────────────────┤
│ [Export]  [History]                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 1: Select Template                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Revenue  │ │ Expense  │ │ Other    │            │
│  │ RV-001   │ │ PV-001   │ │ JV-001   │            │
│  │ 12 docs  │ │ 8 docs   │ │ 3 docs   │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│  Step 2: Select Documents                           │
│  [Strong (8)] [Suitable (3)] [Other (1)]            │
│  ┌───────────────────────────────────────────────┐  │
│  │ ☐ │ Date     │ Issuer   │ Amount  │ Match    │  │
│  │ ☑ │ 15 Mar  │ บจก.ABC │ ฿12,000 │ Strong   │  │
│  │ ☑ │ 14 Mar  │ Watsadu │ ฿8,400  │ Strong   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Export Mode: (•) Document Level  ( ) Item Level    │
│  Records: 8  Total: ฿156,200  Range: 1-15 Mar      │
│                                                     │
│  [Preview Export]  [Download Excel]                  │
└─────────────────────────────────────────────────────┘
```

### Features

- **Template selection:** Card-based picker grouped by direction (revenue/expense/other). Uses `Card` component with selected state.
- **Document selection:** `DataTable` with tabs for match strength (Strong/Suitable/Other). Checkbox selection with "Select all matched" button.
- **Export mode:** `RadioGroup` for Document Level vs Item Level
- **Stats summary:** Record count, total amount, date range (auto-calculated from selection)
- **Preview:** Modal showing a summary table of selected documents (issuer, amount, journal type, account codes) before triggering the actual export. This is a client-side preview from already-loaded data, not a server-rendered Excel preview.
- **Export History tab:** `DataTable` showing past exports with columns: Date, Template, Records, Total Amount, Status, [Re-download] button
- **Toast notifications:** Export success/failure

### Components Used

`Tabs`, `Card`, `DataTable`, `RadioGroup`, `Button`, `Badge`, `Modal`, `StatCard` (for summary stats), `Toast`, `EmptyState`

### API Endpoints

- `GET /api/export/templates?tenantId={id}` (existing)
- `POST /api/export/express` (existing)
- `GET /api/export/download/{id}` (existing)

### New API Needed

- `GET /api/tenants/{id}/reports/export-history` (existing) — Returns past exports from `exportTemplateSelections` table. **Note:** Table currently lacks `totalAmount` and `status` columns; these need adding as a backend migration or computed at query time from `documentIds`.

---

## 6. Page Removals

### Approvals Page (`/approvals`)

- **Current:** 69-line page showing PENDING_APPROVAL documents as cards
- **Action:** Replace with redirect component:
  ```tsx
  // src/app/(app)/approvals/page.tsx
  redirect("/documents?tab=pending");
  ```
- **Sidebar:** Update Approvals nav link href to `/documents?tab=pending`

### Query Tray Page (`/query-tray`)

- **Current:** 74-line read-only table of QUERY documents
- **Action:** Replace with redirect component:
  ```tsx
  // src/app/(app)/query-tray/page.tsx
  redirect("/documents?tab=query");
  ```
- **Sidebar:** Query Tray is not in sidebar (no change needed)

---

## 7. Shared Improvements

### All Pages

- Replace all hardcoded Tailwind colors (`slate-*`, `blue-*`, etc.) with CSS variable design tokens
- Use design system components (Button, Input, Card, Badge, etc.) instead of inline HTML
- Add `Skeleton` loading states for initial data fetch
- Add `EmptyState` components with helpful CTAs
- Add `Toast` notifications for all user actions (success/error)
- Use `tabular-nums` class on all financial amounts

### State Management

- **Zustand:** Use `useUIStore` for toasts (already set up in Phase 1)
- **React Query:** Migrate from raw `fetch` + `useState` to `@tanstack/react-query` for:
  - Automatic caching and refetching
  - Loading/error states
  - Optimistic updates for approve/reject/submit actions
  - Polling for OCR status on Upload page

### Navigation Updates

Update `src/components/sidebar.tsx` nav groups:
- **Re-point** Approvals nav item: keep it in the sidebar but change `href` to `/documents?tab=pending` (not removed — users expect to see "Approvals" in nav)
- Change Documents section to include sub-badge for pending count
- Keep Export, Dashboard, Settings as-is

### Responsive Design

- Mobile: Single column, side panel becomes full-screen overlay
- Tablet: Narrower side panel (~320px)
- Desktop: Full layout as designed above

---

## 8. File Structure

### New/Modified Files

```
src/
  app/(app)/
    dashboard/page.tsx          # REWRITE — tabbed dashboard with charts
    documents/page.tsx          # REWRITE — DataTable + side panel
    extractions/page.tsx        # REWRITE — two-column editing
    upload/page.tsx             # REWRITE — drag-drop + live OCR status
    export/page.tsx             # REWRITE — templates + history + preview
    approvals/page.tsx          # REPLACE — redirect to /documents?tab=pending
    query-tray/page.tsx         # REPLACE — redirect to /documents?tab=query
  components/
    document-side-panel.tsx     # CREATE — slide-out document preview panel
    document-image-viewer.tsx   # CREATE — zoomable document image/PDF viewer
    confidence-bar.tsx          # CREATE — confidence score visualization
    upload-queue.tsx            # CREATE — upload queue with OCR polling
    status-timeline.tsx         # CREATE — document status history timeline
    stat-card.tsx               # MODIFY — add optional `href` prop for clickable cards
    data-table.tsx              # MODIFY — add `onRowClick` prop
  lib/
    hooks/
      use-documents.ts          # CREATE — React Query hooks for document CRUD
      use-dashboard.ts          # CREATE — React Query hooks for dashboard data
      use-export.ts             # CREATE — React Query hooks for export operations
```

### Dependencies

- `recharts` (already installed) — dashboard charts
- `@tanstack/react-query` (already installed) — data fetching

---

## 9. API Changes Needed

| Endpoint | Change | Reason |
|----------|--------|--------|
| `GET /api/documents` | Add `page`, `limit`, `sort`, `order`, `search` query params | Pagination + sorting + search |
| `GET /api/tenants/{id}/reports/export-history` | **Existing** — enhance to include computed `totalAmount` (sum from linked documents) and record count | Export history tab |
| `GET /api/tenants/{id}/reports/status-breakdown` | **New endpoint** | Dashboard donut chart (document counts by status) |

These are minimal backend additions. All existing endpoints remain unchanged.
