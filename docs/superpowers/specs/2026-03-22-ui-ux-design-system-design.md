# AICount UI/UX Design System — Phase 1 Spec

## Overview

AICount is a Thai accounting SaaS that aims to fully replace Express Accounting software with a modern, AI-assisted alternative. This spec defines Phase 1: the design system foundation, component library, and app shell that all subsequent pages will build on.

**Target users:** Professional accountants and bookkeepers at Thai SMEs who use the app daily. Power users who value efficiency, keyboard shortcuts, and information density.

**Design direction:** Xero (clean, trustworthy, accounting-native) meets Notion (information density, flexible workspace feel). Trust Blue palette, Inter + Noto Sans Thai typography.

## Design System

### Color Palette — Trust Blue

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#2563EB` | Buttons, links, active nav, focus rings |
| `--primary-hover` | `#1D4ED8` | Hover state for primary |
| `--primary-light` | `#EFF6FF` | Active nav background, selected row |
| `--secondary` | `#475569` | Secondary buttons, muted actions (slate-600) |
| `--success` | `#059669` | Approved status, positive amounts, growth indicators |
| `--success-light` | `#D1FAE5` | Success badge background |
| `--destructive` | `#DC2626` | Errors, rejected, delete actions |
| `--destructive-light` | `#FEE2E2` | Error badge background, error input border bg |
| `--warning` | `#F59E0B` | Pending, attention needed |
| `--warning-light` | `#FEF3C7` | Warning badge background |
| `--background` | `#F8FAFC` | Page background (replaces existing `#ffffff` — intentional shift to slate-50 for accounting aesthetic) |
| `--foreground` | `#0F172A` | Primary text, headings (replaces existing `#171717`) |
| `--card` | `#FFFFFF` | Card backgrounds, sidebar, header |
| `--card-foreground` | `#0F172A` | Text on cards |
| `--muted` | `#F1F5F9` | Disabled backgrounds, muted areas |
| `--muted-foreground` | `#64748B` | Secondary text, labels, placeholders |
| `--border` | `#E2E8F0` | Card borders, dividers, input borders |
| `--ring` | `#2563EB` | Focus ring color |

#### Document Status Colors

| Status | Background | Text |
|--------|-----------|------|
| Draft | `#F1F5F9` | `#475569` |
| OCR Processing | `#DBEAFE` | `#1D4ED8` |
| Query | `#FEF3C7` | `#92400E` |
| Action Required | `#FFEDD5` | `#C2410C` |
| Pending Approval | `#FEF3C7` | `#92400E` |
| Rejected | `#FEE2E2` | `#DC2626` |
| Approved | `#D1FAE5` | `#065F46` |
| Exported | `#EDE9FE` | `#6D28D9` |
| Void | `#F1F5F9` | `#64748B` |

### Typography

**Fonts:**
- Primary: Inter (Latin) + Noto Sans Thai (Thai characters)
- Monospace: Geist Mono (account codes, amounts in tables)
- Load Inter and Noto Sans Thai via `next/font/google` in `layout.tsx`, consistent with existing Geist loading pattern
- Remove Geist Sans import from `layout.tsx`; keep Geist Mono
- Update `--font-sans` in `@theme inline` to point to the new Inter CSS variable
- Update CLAUDE.md fonts section to reflect Inter + Noto Sans Thai

**Type Scale:**

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Page Title | 24px | 700 | Top of each page |
| Section Heading | 18px | 600 | Card titles, section headers |
| Subheading | 16px | 600 | Sub-sections, table group headers |
| Body | 14px | 400 | Default text, descriptions |
| Small / Label | 12px | 500 | Column headers, labels, helper text |
| Caption | 11px | 400 | Timestamps, metadata |

**Numeric display:** All financial amounts and account codes use `font-variant-numeric: tabular-nums` for column alignment.

### Spacing Scale

Base unit: 4px. Scale: 4 — 8 — 12 — 16 — 24 — 32 — 48 — 64

- Component internal padding: 8–16px
- Card padding: 20–24px
- Section gaps: 24–32px
- Page padding: 24px (mobile 16px)

### Border Radius

| Element | Radius |
|---------|--------|
| Inputs, selects | 6px |
| Buttons, badges | 8px |
| Cards, toasts | 10px |
| Modals | 12px |
| Avatars | 50% (circle) |

### Shadows

| Level | Shadow | Usage |
|-------|--------|-------|
| sm | `0 1px 2px rgba(0,0,0,0.05)` | Cards on hover |
| md | `0 4px 12px rgba(0,0,0,0.08)` | Dropdowns, tooltips |
| lg | `0 20px 60px rgba(0,0,0,0.15)` | Modals |

### Transitions

- Default: `150ms ease-out` for color/opacity changes
- Layout: `200ms ease-out` for size/position changes
- All transitions respect `prefers-reduced-motion`

## App Shell

### Layout Structure

```
┌──────────────────────────────────────────────────┐
│ Sidebar (230px)  │  Header (56px, sticky)        │
│                  │──────────────────────────────── │
│  [Logo]          │  Page Title    [Search] [User] │
│  [Workspace]     │──────────────────────────────── │
│                  │                                │
│  DOCUMENTS       │  Main Content Area             │
│   Upload & OCR   │  (scrollable, padding: 24px)   │
│   All Documents  │                                │
│   Approvals (5)  │                                │
│                  │                                │
│  ACCOUNTING      │                                │
│   General Ledger │                                │
│   Accts Recv.    │                                │
│   Accts Pay.     │                                │
│   Bank Recon     │                                │
│                  │                                │
│  REPORTS         │                                │
│   Financial Stmt │                                │
│   Tax Reports    │                                │
│   WHT Certs      │                                │
│                  │                                │
│  ─────────────── │                                │
│  Settings        │                                │
└──────────────────────────────────────────────────┘
```

### Sidebar

- **Width:** 230px fixed on desktop (changed from existing 220px), collapsible on mobile
- **Background:** white (`--card`) with right border (`--border`)
- **Logo:** AICount logo (blue square + text), top of sidebar
- **Workspace selector:** Below logo, shows company name + tax ID, click to switch (moved from header in current layout)
- **Navigation groups:** Uppercase labels (11px, `--muted-foreground`), nav items (13px)
- **Active state:** `--primary-light` background, `--primary` text color
- **Badge counts:** Red badge for items requiring attention (e.g., pending approvals)
- **Bottom:** Settings link, pinned to bottom
- **Mobile:** Hidden by default, hamburger icon in header to toggle overlay

### Header

- **Height:** 56px, sticky top
- **Background:** white (`--card`) with bottom border (`--border`)
- **Left:** Page title (16px/600 — smaller than page-level 24px title since header is a navigation bar context)
- **Right:** Global search input (Cmd+K shortcut) + user avatar
- **Search:** `--muted` background, 200px min-width, opens command palette overlay

### Navigation Structure

The sidebar replaces the flat nav array in the existing `(app)/layout.tsx`. The existing layout's inline sidebar code will be replaced by the new `sidebar.tsx` component.

```ts
const navGroups = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    ],
  },
  {
    label: "DOCUMENTS",
    items: [
      { href: "/upload", label: "Upload & OCR", icon: "Upload" },
      { href: "/documents", label: "All Documents", icon: "FileText" },
      { href: "/approvals", label: "Approvals", icon: "CheckCircle2", badge: "pending_count" },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { href: "/ledger", label: "General Ledger", icon: "BookOpen" },
      { href: "/receivables", label: "Accounts Receivable", icon: "ArrowDownToLine" },
      { href: "/payables", label: "Accounts Payable", icon: "ArrowUpFromLine" },
      { href: "/bank-recon", label: "Bank Recon", icon: "Landmark" },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { href: "/reports/financial", label: "Financial Statements", icon: "BarChart3" },
      { href: "/reports/tax", label: "Tax Reports", icon: "ClipboardList" },
      { href: "/reports/wht", label: "WHT Certificates", icon: "FileCheck" },
    ],
  },
];
```

### Dark Mode

Dark mode is out of scope for Phase 1. The CSS variable architecture supports future dark mode via `@media (prefers-color-scheme: dark)` or class-based toggle.

### Responsive Breakpoints

| Breakpoint | Behavior |
|-----------|----------|
| < 768px (mobile) | Sidebar hidden, hamburger menu, single column content |
| 768–1024px (tablet) | Sidebar collapsed (icons only, 64px), expand on hover |
| > 1024px (desktop) | Full sidebar (230px), multi-column content |

## Component Library

### 1. Button

**Variants:** primary, secondary, destructive, ghost, link
**Sizes:** sm (32px height), md (36px), lg (40px)
**States:** default, hover, active, disabled, loading (spinner icon)
**Props:** `variant`, `size`, `disabled`, `loading`, `icon` (optional leading icon), `children`

### 2. Input

**Types:** text, number, date, password (with toggle)
**States:** default, focused, error, disabled
**Structure:** Label (optional required indicator) → Input → Helper text or error message
**Props:** `label`, `error`, `helperText`, `required`, `type`, etc.

### 3. Select / Combobox

Dropdown select with search/filter capability. Used for COA selection, vendor picker, etc.
**Props:** `options`, `value`, `onChange`, `searchable`, `placeholder`

### 4. Checkbox

Standard checkbox with label. Supports indeterminate state for table select-all.
**Props:** `checked`, `onChange`, `label`, `indeterminate`

### 5. Radio Group

Radio buttons for single selection (e.g., document type filter).
**Props:** `options`, `value`, `onChange`, `name`

### 6. Toggle / Switch

Boolean toggle for settings (e.g., enable notifications).
**Props:** `checked`, `onChange`, `label`

### 7. Badge / Status

Pill-shaped status indicator. Pre-defined variants for all document statuses.
**Props:** `variant` (draft, processing, query, action_required, pending, rejected, approved, exported, void), `children`

### 8. Table

Data table with sortable columns, row selection, and pagination.
**Features:** Sticky header, zebra striping (optional), row hover, column sorting indicators, select all checkbox, empty state, right-aligned numeric columns with `tabular-nums`, optional footer row for totals/subtotals, fixed-width amount columns
**Props:** `columns` (with `align` and `width` options), `data`, `sortable`, `selectable`, `onSort`, `onSelect`, `emptyMessage`, `footer`

### 9. Card

Container component for content grouping.
**Variants:** default (border), stat (with title, value, trend indicator)
**Props:** `variant`, `title`, `children`

### 10. StatCard

Dashboard stat display: title, large number, trend indicator (up/down/neutral with color).
**Props:** `title`, `value`, `trend`, `trendValue`, `trendDirection`

### 11. Tabs

Tab navigation with optional count badges. Used for document status filtering.
**Props:** `tabs` (array of { label, value, count? }), `activeTab`, `onChange`

### 12. Modal / Dialog

Overlay dialog for confirmations and forms. Trap focus, close on Escape, backdrop click.
**Variants:** confirm (title, message, actions), form (title, content, actions)
**Props:** `open`, `onClose`, `title`, `children`, `actions`

### 13. Toast

Non-blocking notification. Auto-dismiss after 4 seconds. Stack from bottom-right.
**Variants:** success, error, warning, info
**Props:** `variant`, `message`, `duration`
**Implementation:** Toast provider at root layout, `useToast()` hook for triggering

### 14. Tooltip

Hover/focus tooltip for additional context. Light background, subtle shadow.
**Props:** `content`, `side` (top/right/bottom/left), `children`

### 15. Dropdown Menu

Click-triggered menu for actions (e.g., row actions in table). Supports nested groups and dividers.
**Props:** `trigger`, `items` (array of { label, onClick, icon?, destructive? })

### 16. Skeleton Loader

Placeholder shimmer for loading states. Matches shape of content being loaded.
**Variants:** text (line), circle (avatar), rect (card/image)
**Props:** `variant`, `width`, `height`

### 17. Pagination

Page navigation for tables. Shows current page, total, per-page selector.
**Props:** `currentPage`, `totalPages`, `onPageChange`, `perPage`, `onPerPageChange`

### 18. Breadcrumbs

Navigation breadcrumb trail for settings and nested pages.
**Props:** `items` (array of { label, href })

### 19. Avatar

User/workspace avatar. Initials fallback when no image.
**Sizes:** sm (28px), md (32px), lg (40px) — sm is display-only (non-clickable); clickable avatars use md or lg to meet 44px touch target
**Props:** `src`, `name` (for initials), `size`

### 20. Empty State

Centered message with optional illustration and action button. Used when lists/tables have no data.
**Props:** `icon`, `title`, `description`, `action` (button props)

## Implementation Notes

### File Structure

All components go in `src/components/` (flat structure per project convention):

```
src/components/
  button.tsx
  input.tsx
  select.tsx
  checkbox.tsx
  radio-group.tsx
  toggle.tsx
  badge.tsx
  data-table.tsx
  card.tsx
  stat-card.tsx
  tabs.tsx
  modal.tsx
  toast.tsx
  tooltip.tsx
  dropdown-menu.tsx
  skeleton.tsx
  pagination.tsx
  breadcrumbs.tsx
  avatar.tsx
  empty-state.tsx
  sidebar.tsx          # App shell sidebar
  header.tsx           # App shell header
  global-search.tsx    # Already exists, refactor to match new design
  offline-banner.tsx   # Already exists, restyle
  onboarding-modal.tsx # Already exists, refactor to use Modal component
  workspace-selector.tsx # Already exists, refactor to match new design
```

### globals.css Overhaul

Replace current minimal CSS variables with full design token set. Add Inter + Noto Sans Thai font imports. Keep Tailwind CSS v4 `@theme inline` pattern.

### Font Loading

Use `next/font/google` for Inter and Noto Sans Thai in `layout.tsx`, consistent with the existing Geist loading pattern:

```tsx
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { GeistMono } from "geist/font/mono";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansThai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-noto-thai" });
```

Remove the Geist Sans import. Keep GeistMono for monospace.

### UI State Management

Sidebar open/close state, mobile menu toggle, and toast queue managed via a Zustand store:

```
src/lib/stores/ui-store.ts
```

Exports: `useSidebarOpen()`, `useToast()`, `useMobileMenu()`

### Layout Migration

The existing `src/app/(app)/layout.tsx` contains inline sidebar and header code with inline SVG icons. This will be replaced:
- Sidebar code → new `sidebar.tsx` component (using lucide-react icons)
- Header code → new `header.tsx` component
- Layout becomes a thin wrapper composing sidebar + header + main content area

### Component Patterns

- All components use named exports
- `"use client"` only where interactivity requires it
- Props typed with TypeScript interfaces
- Use `lucide-react` for all icons (no emoji icons)
- Tailwind utility classes for all styling, using CSS variable tokens
- `forwardRef` for input components to support form libraries
- Keyboard accessible: focus rings, escape to close, tab navigation

### Accessibility Requirements

- All interactive elements: minimum 44x44px touch target
- Color contrast: 4.5:1 minimum for text, 3:1 for large text
- Focus rings: 2px solid `--ring` with 2px offset
- Form inputs: visible labels (not placeholder-only)
- Modals: focus trap, close on Escape, aria-modal
- Toasts: aria-live="polite", do not steal focus
- Tables: proper thead/tbody, sortable columns announce sort state
- Reduced motion: respect `prefers-reduced-motion`

## Phasing Plan

This spec covers **Phase 1** only. Subsequent phases each get their own spec:

1. **Phase 1: Design System + Component Library** ← this spec
   - CSS tokens in globals.css
   - 20 base components
   - App shell (sidebar + header)
   - Refactor 4 existing components to match

2. **Phase 2: Core Workflow Pages**
   - Upload & OCR, All Documents, Extractions, Approvals, Export

3. **Phase 3: Full Accounting Modules**
   - General Ledger, Accounts Receivable, Accounts Payable, Bank Reconciliation

4. **Phase 4: Reports & Tax**
   - Financial Statements (Balance Sheet, P&L, Cash Flow, Trial Balance)
   - Tax Reports (ภ.พ.30, ภ.พ.36, ภ.ง.ด. series)
   - WHT Certificates (50 ทวิ)

5. **Phase 5: Settings, Master Data, Auth & Onboarding** ✅ COMPLETED (2026-03-22)
   - ~~COA, vendors, customers, departments, products~~ → Migrated to `/settings/masterdata/*`
   - ~~Login/signup polish, onboarding wizard redesign~~ → Auth callback, email verification, dedicated onboarding pages
   - Settings overhaul with sidebar navigation at `/settings/*`
   - Account & workspace soft delete with 30-day grace period
   - See: `docs/superpowers/specs/2026-03-22-auth-settings-rework-design.md`
   - **Remaining:** Restyle all new pages to use Phase 1 design system components once available

6. **Phase 6: AI Assistant & Suggestion System**
   - AI provider abstraction layer (Claude default, swappable)
   - Inline suggestion components (COA mapping, WHT, duplicates)
   - Command palette AI chat mode (extend Cmd+K)
   - Learning engine + correction tracking
   - Cross-tenant anonymized insights
   - AI-powered onboarding suggestions
   - Privacy controls and opt-out

## AI Assistant & Suggestion System

AICount's core differentiator: an AI co-worker that learns from user behavior and proactively reduces workload.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Service Layer                         │
│  src/lib/services/ai/                                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ ai-provider  │  │ suggestion   │  │ learning-engine       │ │
│  │ .ts          │  │ -engine.ts   │  │ .ts                   │ │
│  │              │  │              │  │                       │ │
│  │ Abstract     │  │ Generates    │  │ Tracks corrections,   │ │
│  │ provider     │  │ contextual   │  │ builds patterns,      │ │
│  │ interface    │  │ suggestions  │  │ cross-tenant insights │ │
│  └──────┬───────┘  └──────────────┘  └───────────────────────┘ │
│         │                                                       │
│  ┌──────┴───────┐                                              │
│  │ providers/   │                                              │
│  │  claude.ts   │  ← default provider                         │
│  │  (future:    │                                              │
│  │   openai.ts  │                                              │
│  │   local.ts)  │                                              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

### AI Provider Abstraction

```ts
// src/lib/services/ai/ai-provider.ts
interface AIProvider {
  chat(messages: Message[], context?: AccountingContext): Promise<AIResponse>;
  suggest(type: SuggestionType, context: SuggestionContext): Promise<Suggestion[]>;
  embed(text: string): Promise<number[]>;  // for similarity/pattern matching
}

// Default: Claude API via @anthropic-ai/sdk
// Future: swap or add providers without changing consumer code
```

### UI Surfaces — Mixed Approach

**1. Inline Suggestions (workflow integration)**

Appear directly in the user's workflow — no extra clicks needed:

- **COA Mapping:** When AI maps a document to a GL account, show a suggestion chip above the account field: "AI suggests 5300-001 (Office Supplies) — 94% confidence" with Accept/Reject buttons
- **WHT Rate:** "This vendor typically has 3% WHT applied" suggestion when creating a payable
- **Duplicate Warning:** Yellow banner at top of document: "Similar invoice from this vendor found (INV-2024-0298, ฿45,000, 15 มี.ค.)" with View/Dismiss
- **Smart Defaults:** Form fields pre-filled with AI predictions based on vendor/document type patterns, highlighted with a subtle blue left-border to indicate "AI-suggested"
- **Onboarding Suggestions:** During setup, suggest COA templates, department structures, and tax configurations based on company industry/size

**2. Command Palette AI Mode (open-ended questions)**

Extend the existing Cmd+K search with an "Ask AI" mode:

- User types in Cmd+K → sees search results
- Prefix with `?` or click "Ask AI" to switch to assistant mode
- Examples:
  - `? วิธีบันทึกรายการลดหนี้` → AI explains credit note journaling in Thai
  - `? What WHT rate for consulting services?` → AI answers with Thai tax law reference
  - `? Show me all overdue AP for vendor ABC` → AI generates a filtered view
- Streaming response in the palette overlay
- Context-aware: AI knows which page/document the user is viewing

**Component:** Extend `global-search.tsx` with AI chat mode

### Learning & Segmentation Engine

**Per-Tenant Learning:**
- Track when users accept vs. correct AI suggestions (COA mappings, WHT rates, vendor categorization)
- Store correction patterns in `ai_learning_log` table
- Over time, per-tenant model becomes more accurate for that company's patterns
- Example: If tenant always maps "ค่าเช่า" to account 5200-003 instead of AI's suggestion of 5200-001, learn that preference

**Cross-Tenant Anonymized Insights:**
- Aggregate patterns across tenants (anonymized, no company-specific data leaks)
- Segment by industry (from onboarding: retail, services, manufacturing, etc.) and company size
- Use for cold-start suggestions: "Restaurants in your size range typically set up these 15 COA groups"
- Privacy: only aggregate statistics cross tenants, never raw data
- Tenants can opt-out of cross-tenant learning in settings

**Segmentation Dimensions:**
- Industry type (set during onboarding)
- Company size (employee count, revenue range)
- Document volume (high/medium/low)
- Common vendor types
- Tax profile (VAT registered, WHT patterns)

### Data Model

```sql
-- AI suggestion tracking
ai_suggestions (
  id, tenant_id, user_id,
  suggestion_type,    -- 'coa_mapping', 'wht_rate', 'duplicate', 'onboarding', 'general'
  context_json,       -- what triggered the suggestion
  suggestion_json,    -- what was suggested
  outcome,            -- 'accepted', 'rejected', 'modified', 'ignored'
  user_correction,    -- what the user changed it to (if modified)
  created_at
)

-- Learned patterns per tenant
ai_tenant_patterns (
  id, tenant_id,
  pattern_type,       -- 'vendor_coa_map', 'wht_preference', 'department_default'
  pattern_key,        -- e.g., vendor name or document type
  pattern_value,      -- e.g., preferred COA account code
  confidence,         -- 0.0 to 1.0, increases with more data
  sample_count,       -- how many times this pattern was observed
  updated_at
)

-- Cross-tenant anonymized insights
ai_global_insights (
  id,
  segment_key,        -- e.g., 'industry:restaurant:size:small'
  insight_type,       -- 'coa_template', 'common_vendors', 'wht_patterns'
  insight_data,       -- aggregated anonymous data
  sample_count,       -- number of tenants contributing
  updated_at
)
```

### Suggestion Types

| Type | Trigger | Example |
|------|---------|---------|
| `coa_mapping` | Document extraction complete | "Map to 5300-001 Office Supplies (94%)" |
| `wht_rate` | Payable entry for known vendor | "Apply 3% WHT for consulting (based on history)" |
| `duplicate` | Document upload | "Similar to INV-0298 from same vendor" |
| `onboarding_coa` | New tenant setup | "Restaurants your size typically use these 15 accounts" |
| `onboarding_dept` | Department setup step | "Consider: สำนักงานใหญ่, ครัว, บริการ" |
| `tax_advice` | Tax report generation | "3 transactions may need ภ.ง.ด.53 filing" |
| `vendor_info` | New vendor entry | "Auto-fill from cross-tenant data: Tax ID, address" |
| `period_warning` | Approaching period lock | "5 unprocessed documents before March close" |
| `workflow_nudge` | Documents idle in queue | "23 documents pending approval for 3+ days" |

### Privacy & Opt-Out

- Cross-tenant learning is opt-in during onboarding (default: enabled)
- Toggle in Settings → Privacy: "Contribute anonymized patterns to improve suggestions for all users"
- Per-tenant data is never shared — only aggregate statistics
- Suggestion explanations always show source: "Based on your history" vs "Based on similar companies"
- All AI interactions logged in audit trail

## Subscription Model & Cost Architecture

### Tier Structure

AICount is subscription-based. Core accounting features (reports, export, tax) are available in all tiers. Tiers scale on: tenant count, user count, document volume, AI intelligence level, and automation depth.

| | Starter (฿499/mo) | Professional (฿1,499/mo) | Business (฿3,999/mo) |
|---|---|---|---|
| **Target** | Freelance accountant, 1-2 companies | Bookkeeping firm, 5-10 companies | Mid-size firm, 10+ companies |
| **Tenants** | 2 | 10 | Unlimited |
| **Users per tenant** | 2 | 5 | Unlimited |
| **Documents/month** | 100 | 500 | Unlimited |
| **Reports & Export** | All reports, all formats | All reports, all formats | All reports, all formats + API access |
| **Tax reports** | All (ภ.พ.30, ภ.ง.ด., etc.) | All | All + e-filing integration |
| **Bank recon** | Manual matching | Auto-match suggestions | Auto-match + bank feed import |
| **Support** | Email | Priority email | Dedicated + LINE |
| | | | |
| **AI: OCR + Auto-extract** | Included | Included | Included |
| **AI: COA mapping suggestions** | Included | Included | Included |
| **AI: Duplicate detection** | Included | Included | Included |
| **AI: WHT/tax suggestions** | — | Included | Included |
| **AI: Smart defaults (learning)** | — | Included | Included |
| **AI: Chat assistant (Cmd+K ?)** | — | 50 questions/mo | Unlimited |
| **AI: Cross-tenant intelligence** | — | — | Included |
| **AI: Onboarding suggestions** | Basic templates | Industry-specific | Custom + migration assist |

### Cost Control Architecture

AI API calls are the primary variable cost. These strategies keep costs predictable:

**1. API Call Budgeting**
- Each tenant gets a monthly AI credit pool based on subscription tier
- Track usage in `ai_usage` table: `(tenant_id, month, credits_used, credits_limit)`
- Soft limit: warn at 80%, suggest upgrade
- Hard limit: graceful degradation — AI suggestions stop, core accounting still works
- Dashboard widget shows AI credit usage for admins

**2. Response Caching**
- Cache common suggestions keyed by `(tenant_id, suggestion_type, pattern_key)`
- Same vendor → same COA mapping: serve from cache, don't re-call API
- Cache TTL: 30 days, invalidated when user corrects a suggestion
- Expected cache hit rate: 60-80% for mature tenants (major cost saver)

**3. Rules-Based Fallback**
- High-confidence patterns (>95% confidence, 10+ samples) graduate from AI to deterministic rules
- Stored in `ai_tenant_patterns` table, served without API call
- Example: after tenant maps "ค่าไฟฟ้า" to 5400-001 ten times, it becomes a rule
- AI only called for novel/uncertain cases

**4. Batch Processing**
- Cross-tenant learning aggregation runs as nightly Inngest cron job, not real-time
- Bulk pattern extraction uses a single API call per segment, not per-tenant
- Reduces API calls from N-per-tenant to 1-per-segment

**5. Prompt Optimization**
- Suggestion prompts: short, focused, structured output (~500 tokens input, ~100 tokens output)
- Chat prompts: full context but with smart context windowing (only relevant page/document context)
- Use `claude-haiku` for simple pattern matching, `claude-sonnet` for chat, `claude-opus` only for complex multi-document analysis

**6. Tiered Model Selection**

| Task | Model | Estimated Cost/Call |
|------|-------|-------------------|
| COA mapping suggestion | Haiku | ~$0.001 |
| WHT rate lookup | Haiku | ~$0.001 |
| Duplicate detection | Haiku | ~$0.001 |
| Chat Q&A (simple) | Sonnet | ~$0.01 |
| Chat Q&A (complex) | Sonnet | ~$0.03 |
| Cross-tenant pattern analysis | Sonnet (batch) | ~$0.05/segment |
| Document OCR classification | Sonnet | ~$0.02 |

**7. Cost Monitoring**
- Track cost per tenant, per suggestion type, per model
- Alert if any tenant exceeds expected usage patterns (abuse detection)
- Monthly cost report for internal review
- Margin target: AI costs should be <20% of subscription revenue per tier

### Data Model Addition

```sql
-- AI usage tracking per tenant per month
ai_usage (
  id, tenant_id,
  month,              -- '2026-03'
  credits_used,       -- running total
  credits_limit,      -- based on subscription tier
  api_calls_count,    -- total API calls made
  cache_hits_count,   -- calls served from cache
  rule_hits_count,    -- calls served from graduated rules
  estimated_cost_usd, -- for internal tracking
  updated_at
)

-- AI response cache
ai_cache (
  id, tenant_id,
  cache_key,          -- hash of (suggestion_type + context_key)
  response_json,      -- cached AI response
  hit_count,          -- times served from cache
  created_at,
  expires_at          -- TTL: 30 days default
)
```

## AI Differentiators (vs Express)

These UX patterns distinguish AICount from traditional accounting software:

1. **Smart OCR Upload** — Drag-and-drop documents, AI extracts all data automatically
2. **Auto Journal Entry** — AI maps extracted data to GL accounts + tax codes
3. **Confidence Scores** — Visual indicators (progress bars or color coding) showing AI certainty per field
4. **Duplicate Detection** — AI flags potential duplicates before processing
5. **Keyboard-First** — Power user shortcuts for fast approval workflows (j/k navigation, a to approve, r to reject)
6. **Real-Time Processing** — SSE updates show OCR progress live, no page refresh
7. **Global Search + AI Chat** — Cmd+K command palette with "Ask AI" mode for accounting questions
8. **Batch Operations** — Select multiple documents for bulk approve/reject/export
9. **Inline AI Suggestions** — Contextual suggestions appear directly in workflow, learn from corrections
10. **Cross-Tenant Intelligence** — New customers get smart defaults from anonymized patterns of similar companies

## Success Criteria

Phase 1 is complete when:
- [ ] All 20 components are implemented and render correctly
- [ ] globals.css has full design token set
- [ ] Inter + Noto Sans Thai fonts load correctly
- [ ] App shell (sidebar + header) renders with grouped navigation
- [ ] Sidebar is responsive (collapses on mobile/tablet)
- [ ] Global search (Cmd+K) works
- [ ] Existing 4 components are refactored to match new design
- [ ] All components pass accessibility checks (contrast, focus, keyboard nav)
- [ ] Thai text renders correctly throughout
- [ ] Tabular numbers align in financial displays
