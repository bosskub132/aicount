# Implementation Phasing Plan

## Phase 1: Design System + Component Library ← PLAN READY
- CSS tokens in globals.css
- 20 base components + sidebar + header
- Refactor 4 existing components
- Plan: docs/superpowers/plans/2026-03-22-design-system-phase1.md
- IMPORTANT: Frontend only, no backend changes. All existing API routes and logic preserved.

## Phase 2: Core Workflow Pages (not yet specced)
- Upload & OCR, All Documents, Extractions, Approvals, Export
- Will be vertical slices: DB → API → service → UI per module

## Phase 3: Full Accounting Modules (not yet specced)
- General Ledger, Accounts Receivable, Accounts Payable, Bank Reconciliation
- Major backend + frontend work

## Phase 4: Reports & Tax (not yet specced)
- Financial Statements (Balance Sheet, P&L, Cash Flow, Trial Balance)
- Tax Reports (ภ.พ.30, ภ.พ.36, ภ.ง.ด. series)
- WHT Certificates (50 ทวิ)

## Phase 5: Settings, Master Data, Auth & Onboarding (not yet specced)
- COA, vendors, customers, departments, products
- Login/signup polish, onboarding wizard redesign
- Dashboard analytics page

## Phase 6: AI Assistant & Suggestion System (spec written, not yet planned)
- AI provider abstraction (Claude default, swappable)
- Inline suggestions + Cmd+K AI chat
- Learning engine + cross-tenant insights
- Privacy controls + cost management
