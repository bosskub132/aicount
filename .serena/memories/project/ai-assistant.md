# AI Assistant & Suggestion System

## Architecture
- AI provider abstraction: src/lib/services/ai/ai-provider.ts
- Default provider: Claude API (@anthropic-ai/sdk)
- Interface designed for future model swapping (OpenAI, local, etc.)

## Two UI Surfaces
1. **Inline Suggestions** — appear directly in workflow
   - COA mapping chips with confidence scores
   - WHT rate suggestions based on vendor history
   - Duplicate warnings
   - Smart defaults (blue left-border indicator)
   - Onboarding suggestions by industry/size

2. **Cmd+K AI Chat** — extend global search
   - Prefix with "?" to enter AI mode
   - Context-aware (knows current page/document)
   - Streaming responses
   - Supports Thai and English

## Learning System
- Per-tenant: tracks accept/reject/modify on suggestions
- Cross-tenant: anonymized insights segmented by industry + company size
- High-confidence patterns (>95%) graduate to deterministic rules (skip API)
- Privacy: opt-in, toggle in Settings

## Cost Control (7 strategies)
1. API credit budgeting per tenant per tier
2. Response caching (30-day TTL, 60-80% hit rate target)
3. Rules-based fallback for graduated patterns
4. Batch processing for cross-tenant learning (nightly Inngest cron)
5. Prompt optimization (short structured prompts for suggestions)
6. Tiered model selection: Haiku for lookups, Sonnet for chat
7. Cost monitoring: <20% of subscription revenue target

## Data Tables
- ai_suggestions (tracking)
- ai_tenant_patterns (learned rules)
- ai_global_insights (cross-tenant)
- ai_usage (credit tracking)
- ai_cache (response cache)

## Status: Phase 6 (spec written, not yet planned/implemented)
