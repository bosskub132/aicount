# Design System — Phase 1 ✅ COMPLETE

## Status: Implemented and committed on feature/app-v2 (2026-03-23)

## Color Palette (Trust Blue)
- Primary: #2563EB, Hover: #1D4ED8, Light: #EFF6FF
- Secondary: #475569, Hover: #334155
- Success: #059669, Destructive: #DC2626, Warning: #F59E0B
- Background: #F8FAFC, Foreground: #0F172A
- Border: #E2E8F0, Muted: #F1F5F9
- 9 document status color pairs (draft, processing, query, action, pending, rejected, approved, exported, void)
- Z-index scale: dropdown(50), sticky(100), modal(200), toast(300), tooltip(400)

## Typography
- Primary: Inter (Latin) + Noto Sans Thai — via next/font/google
- Monospace: Geist Mono
- Geist Sans REMOVED
- Financial amounts: tabular-nums class

## Component Library (25+ components)
src/components/ (flat):
- Primitives: Button, Input, Badge/StatusBadge, Avatar
- Feedback: Toast/ToastProvider, Modal, Tooltip, DropdownMenu
- Data: Tabs, DataTable (onRowClick), Pagination, StatCard (href), Card, EmptyState, Skeleton
- Forms: Select, Checkbox, RadioGroup, Toggle
- Navigation: Breadcrumbs, Sidebar, Header
- Document: DocumentSidePanel, DocumentImageViewer, ConfidenceBar, StatusTimeline, UploadQueue

## App Shell
- Sidebar (230px): grouped nav, workspace selector, mobile overlay
- Header (56px sticky): page title + Cmd+K search + avatar
- UI state: src/lib/stores/ui-store.ts (Zustand)
- React Query: src/lib/providers/query-provider.tsx wraps app layout
