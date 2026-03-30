# Phase 5C: Accounting Settings Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle 4 accounting settings pages with full functionality — period locks list/toggle, export template CRUD, bank recon settings, tax reports config with links.

**Spec:** `docs/superpowers/specs/2026-03-30-phase5-settings-polish-design.md` (Phase 5C section)

---

## Task 1: Create new schema tables (export_templates, bank_recon_settings, bank_accounts)

Add to Drizzle schema + apply migration to staging via Supabase MCP. Period locks table already exists.

## Task 2: Restyle Period Locks page

Full rewrite of `src/app/(app)/settings/accounting/period-locks/page.tsx`:
- Auto-generate period list from current month back 24 months
- Fetch existing locks from API, merge with generated periods
- DataTable: Period, Status (Badge: Open/Locked), Locked By, Locked At
- Lock button per open period, Unlock (with confirmation Modal) per locked period
- Fix existing API to not expose raw error.message

## Task 3: Restyle Export Templates page

Full rewrite of `src/app/(app)/settings/accounting/templates/page.tsx`:
- Card grid showing templates with name, active status, column count
- Create/Edit Modal with column mapping editor (position, header, source field, format, default)
- Up/down reorder buttons, add/remove columns
- Activate/deactivate toggle
- New API endpoints needed: CRUD for export_templates

## Task 4: Restyle Bank Reconciliation Settings page

Full rewrite of `src/app/(app)/settings/accounting/bank-recon/page.tsx`:
- Matching Rules card: amount tolerance, date range, auto-match toggle, match by reference toggle
- Bank Accounts card: DataTable with CRUD modal
- Save settings button
- New API endpoints needed: CRUD for bank_recon_settings + bank_accounts

## Task 5: Restyle Tax Reports Settings page

Full rewrite of `src/app/(app)/settings/accounting/tax-reports/page.tsx`:
- Tax Filing Info card: filing frequency (read-only), VAT rate, WHT default rate (Select), Tax ID (from workspace)
- Quick Links card: links to Tax Report Hub, WHT Certificates, VAT Registers
- Save settings for WHT default rate

## Task 6: Final verification
