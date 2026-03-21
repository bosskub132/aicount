# Key Files Reference

## Pages
- `src/app/(app)/upload/page.tsx` — Unified upload UI (drag-drop, duplicate flags)
- `src/app/(app)/extractions/page.tsx` — OCR extraction detail view (image + fields + raw JSON)
- `src/app/(app)/documents/page.tsx` — Document listing with status filters
- `src/app/(app)/layout.tsx` — App shell (sidebar + main, h-screen constrained)

## API Routes
- `src/app/api/documents/upload/route.ts` — Single upload (allows duplicates, flags them)
- `src/app/api/documents/upload-batch/route.ts` — Batch upload (allows duplicates, flags them)
- `src/app/api/documents/[id]/route.ts` — Document CRUD
- `src/app/api/documents/[id]/submit/route.ts` — Submit for approval

## Services
- `src/lib/services/ocr.ts` — OCR extraction (Google Vision + Claude paths)
- `src/lib/services/prompts/tier1_prompt` — Tier 1 OCR prompt (basic fields)
- `src/lib/services/prompts/tier2_prompt` — Tier 2 OCR prompt (detailed, line items, customer)
- `src/lib/services/document-intake.ts` — Upload validation, hashing, persistence
- `src/lib/services/vat-rules.ts` — VAT classification
- `src/lib/services/confidence.ts` — Weighted confidence scoring
- `src/lib/services/math-validation.ts` — Amount equation validation

## Background Jobs
- `src/lib/inngest/functions/process-document.ts` — OCR pipeline (extract → validate → classify → tax/GL → persist)

## Database
- `src/lib/db/schema.ts` — Drizzle schema (documents, tenants, profiles, etc.)
- `src/lib/db/queries/documents.ts` — Document queries
