# OCR Provider Change (2026-03-22)

Default OCR provider switched from Claude API (Anthropic) to Google Vision API.

## Key Details
- Default is now Google Vision — no env var needed, or set `OCR_PROVIDER=google_vision`
- Claude OCR still available as fallback: set `OCR_PROVIDER=claude`
- Required env var: `GOOGLE_VISION_API_KEY`
- `ANTHROPIC_API_KEY` only needed if switching back to Claude
- Health check (`/api/health`) verifies `GOOGLE_VISION_API_KEY`

## Files Changed
- `src/lib/services/ocr.ts` — flipped conditional in `extractBillData()` so Google Vision is default
- `src/app/api/health/route.ts` — checks `GOOGLE_VISION_API_KEY` instead of `ANTHROPIC_API_KEY`
- `.env.example` — updated defaults
