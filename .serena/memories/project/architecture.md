# AICount - Project Architecture

## Overview
Thai accounting SaaS: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL via Drizzle ORM).

## Key Directories
- `src/app/(app)/` — Authenticated pages (upload, extractions, documents, approvals, settings, export)
- `src/app/(auth)/` — Auth pages (login, signup, invite)
- `src/app/api/` — API route handlers
- `src/components/` — Shared UI components (flat, no ui/ subfolder)
- `src/lib/services/` — Business logic (OCR, confidence, VAT, WHT, audit)
- `src/lib/db/` — Drizzle schema, relations, queries
- `src/lib/inngest/` — Background job definitions
- `src/types/` — Domain and API type definitions

## OCR Pipeline
- Default provider: Google Vision (`GOOGLE_VISION_API_KEY`)
- Optional: Claude API (`OCR_PROVIDER=claude`)
- Entry: `src/lib/services/ocr.ts` → `extractBillData()` / `extractBillDataGoogleVision()`
- Prompts: `src/lib/services/prompts/tier1_prompt`, `tier2_prompt`
- Background processing: `src/lib/inngest/functions/process-document.ts`

## OCR Line-Item Parser
Generic tag-based parser in `extractFromGoogleVisionText()` handles 4+ Thai receipt formats:
1. **Block-style** (Watsons): coded items block → header → numbers block
2. **Sequential** (Thai Watsadu): row# → desc → individual numbers
3. **Name-block** (The Mall): product names block → split headers → numbers + tax flags
4. **Hybrid** (CP Extra): block start → interleaved trailing items, V/N suffix on numbers

Key patterns: `stripTaxFlag` removes V/N suffix, `productSizePattern` detects Thai product names by units (กรัม/ML/G), tax flag column detection (values all ≤2).

## Layout
- App layout: `src/app/(app)/layout.tsx` — sidebar (220px) + main content
- Root: `h-screen overflow-hidden` grid, main uses `flex flex-col overflow-hidden`
- Content wrapper: `min-h-0 flex-1 overflow-auto` — pages scroll within this container

## Upload Flow
- Unified upload UI: drag-and-drop, supports single + batch
- Duplicates are ALLOWED but flagged (isDuplicate in response + amber tag in UI)
- API: `/api/documents/upload` (single), `/api/documents/upload-batch` (batch)
- Files persisted to `public/generated/uploads/{tenantId}/{date}/{batchId}/`

## Extraction Page (`src/app/(app)/extractions/page.tsx`)
- Document carousel at top for selection
- Two-column layout: image (1fr) | extraction fields (2fr)
- Sections: Issuer Info (1-5), Transaction Details (6-10), Line Items & Pricing (11-14), Customer/Buyer (15-17), Additional Info (18-23), Raw OCR JSON
- Editable fields with save/submit workflow
- Raw OCR JSON panel (collapsible, dark theme, copy button)

## Styling
- Tailwind CSS v4 with `@theme inline` in `globals.css`
- Icons: `lucide-react` only
- CSS variables for colors, Geist fonts
