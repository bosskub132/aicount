# Design System — Phase 1

## Spec & Plan
- Spec: `docs/superpowers/specs/2026-03-22-ui-ux-design-system-design.md`
- Plan: `docs/superpowers/plans/2026-03-22-design-system-phase1.md`

## Color Palette (Trust Blue)
- Primary: #2563EB (buttons, links, active states)
- Primary Hover: #1D4ED8
- Primary Light: #EFF6FF (active nav bg)
- Secondary: #475569 (secondary buttons, slate-600)
- Success: #059669 (approved, positive amounts)
- Destructive: #DC2626 (errors, rejected)
- Warning: #F59E0B (pending, attention)
- Background: #F8FAFC (page bg, replaces #ffffff)
- Foreground: #0F172A (text, replaces #171717)
- Border: #E2E8F0
- Muted: #F1F5F9

## Typography
- Primary: Inter (Latin) + Noto Sans Thai — loaded via next/font/google
- Monospace: Geist Mono (kept from original)
- Geist Sans is REMOVED
- Type scale: 24px (title), 18px (section), 16px (subheading), 14px (body), 12px (label), 11px (caption)
- Financial amounts use font-variant-numeric: tabular-nums

## Component Library (20 components)
All in src/components/ (flat structure):
Button, Input, Select, Checkbox, RadioGroup, Toggle, Badge/StatusBadge, DataTable, Card, StatCard, Tabs, Modal, Toast, Tooltip, DropdownMenu, Skeleton, Pagination, Breadcrumbs, Avatar, EmptyState

## App Shell
- Sidebar (sidebar.tsx): 230px, white, grouped nav (Documents, Accounting, Reports)
- Header (header.tsx): 56px sticky, page title + search (Cmd+K) + avatar
- WorkspaceSelector moved from header to sidebar
- UI state via Zustand store: src/lib/stores/ui-store.ts

## Navigation Groups
- Dashboard
- DOCUMENTS: Upload & OCR, All Documents, Approvals
- ACCOUNTING: General Ledger, AR, AP, Bank Recon
- REPORTS: Financial Statements, Tax Reports, WHT Certificates
- Settings (bottom)

## Status: Not yet implemented (plan ready for execution)
