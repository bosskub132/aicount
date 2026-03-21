---
name: aicount-inngest-jobs
description: >-
  Guides adding Inngest background jobs in aicount: event naming, function
  patterns, step orchestration, cron schedules, retries, and registration.
  Use when creating or modifying background jobs, cron tasks, async document
  processing, or notification delivery.
user_invocable: true
---

# aicount — Inngest background jobs

## When to use this skill

Read this before:
- Adding a **new background function** (event-triggered or cron)
- Modifying the **document processing pipeline** steps
- Adding **notification** or **email** delivery logic
- Creating **scheduled maintenance** tasks
- Wiring a new function into the **Inngest route handler**

## Repo map

| File | Role |
|------|------|
| `src/lib/inngest/client.ts` | Inngest client instance (app ID: "aicount") |
| `src/lib/inngest/functions/` | All background function definitions |
| `src/app/api/inngest/route.ts` | Webhook handler — registers all functions |

### Existing functions

| Function | File | Trigger | Purpose |
|----------|------|---------|---------|
| `processDocument` | `process-document.ts` | `document/uploaded` | OCR → classify → tax → GL → persist |
| `sendWeeklyDigest` | `send-notifications.ts` | Cron: Mon 9AM BKK | Weekly unread notification digest |
| `notifyDocumentRejected` | `send-notifications.ts` | `document/rejected` | Rejection notification + email |
| `notifyDocumentPendingApproval` | `send-notifications.ts` | `document/pending_approval` | Pending approval notification + email |
| `applyDataRetention` | `data-retention.ts` | Cron: daily 2AM BKK | Archive old documents per retention policy |
| `autoExpirePendingApprovals` | `workflow-maintenance.ts` | Cron: every 6h BKK | Expire pending >72h → ACTION_REQUIRED |

## Adding a new event-triggered function

### 1. Define the function

Create a new file or add to an existing file in `src/lib/inngest/functions/`:

```typescript
import { inngest } from "../client";
import { db } from "@/lib/db";
import { myTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const myNewFunction = inngest.createFunction(
  {
    id: "my-function-name",        // kebab-case, unique across app
    retries: 2,                     // 1-3 depending on criticality
  },
  { event: "entity/action" },      // event name: "entity/action" format
  async ({ event, step }) => {
    const { entityId, tenantId } = event.data;

    // Step 1 — each step is independently retried
    const entity = await step.run("load-entity", async () => {
      const [row] = await db
        .select()
        .from(myTable)
        .where(eq(myTable.id, entityId))
        .limit(1);
      if (!row) throw new Error(`Entity ${entityId} not found`);
      return row;
    });

    // Step 2 — use results from previous steps
    const result = await step.run("process-entity", async () => {
      // Business logic here
      return { processed: true };
    });

    // Step 3 — persist results
    await step.run("persist-results", async () => {
      await db
        .update(myTable)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(myTable.id, entityId));
    });

    // Return summary — logged by Inngest dashboard
    return { entityId, tenantId, result };
  }
);
```

### 2. Adding a cron-triggered function

```typescript
export const myScheduledTask = inngest.createFunction(
  {
    id: "my-scheduled-task",
    retries: 1,
  },
  { cron: "TZ=Asia/Bangkok 0 2 * * *" },  // Always use Bangkok timezone
  async ({ step }) => {
    // Load data to process
    const items = await step.run("load-items", async () => {
      return db.select().from(myTable).where(/* ... */);
    });

    // Process each item — use dynamic step IDs
    for (const item of items) {
      await step.run(`process-${item.id}`, async () => {
        // Per-item logic
      });
    }

    return { processed: items.length };
  }
);
```

**Cron conventions:**
- Always prefix with `TZ=Asia/Bangkok`
- Common schedules: `0 2 * * *` (daily 2AM), `0 9 * * MON` (weekly Monday 9AM), `0 */6 * * *` (every 6h)

### 3. Register in the route handler

Edit `src/app/api/inngest/route.ts`:

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { myNewFunction } from "@/lib/inngest/functions/my-new-file";
// ... existing imports

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // ... existing functions
    myNewFunction,   // Add here
  ],
});
```

### 4. Send the event (from API routes)

```typescript
import { inngest } from "@/lib/inngest/client";

// In your API route handler:
await inngest.send({
  name: "entity/action",
  data: {
    entityId: "uuid-here",
    tenantId: "uuid-here",
    // other data the function needs
  },
});
```

## Event naming conventions

Format: `"entity/action"` — lowercase, underscore for multi-word actions.

| Pattern | Examples |
|---------|----------|
| Document events | `document/uploaded`, `document/rejected`, `document/pending_approval` |
| Entity CRUD | `vendor/created`, `tenant/updated` |
| Process events | `export/requested`, `reconciliation/started` |

## Step patterns

**Step IDs:** lowercase, hyphen-separated, unique within the function. Descriptive of what the step does.

```typescript
// Good step IDs
await step.run("ocr-extract", async () => { ... });
await step.run("validate-math", async () => { ... });
await step.run("persist-results", async () => { ... });

// Dynamic step IDs for loops
await step.run(`archive-${tenant.id}`, async () => { ... });
```

**Key rules:**
- Each `step.run()` is independently retried on failure
- Steps should be **idempotent** — safe to retry
- Return serializable data from steps (no functions, no circular refs)
- Use results from previous steps via the returned value
- Throw `Error` for validation failures — Inngest will retry up to `retries` count

## Email notification pattern

Follow the existing pattern in `send-notifications.ts`:

```typescript
// 1. Insert in-app notification
await db.insert(notifications).values({
  userId: targetUserId,
  title: "Notification title",
  body: "Details here",
  link: `/documents/${documentId}`,
});

// 2. Check email preference
const [prefs] = await db
  .select()
  .from(notificationPreferences)
  .where(eq(notificationPreferences.userId, targetUserId))
  .limit(1);

// 3. Send email if enabled and API key exists
if (prefs?.emailOnReject && process.env.RESEND_API_KEY) {
  const [user] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, targetUserId))
    .limit(1);

  if (user?.email) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "AiCount <noreply@yourdomain.com>",
      to: user.email,
      subject: "Subject line",
      text: "Plain text body",
    });
  }
}
```

## Retry guidelines

| Criticality | Retries | Use case |
|-------------|---------|----------|
| High (data processing) | 3 | `processDocument` — OCR pipeline |
| Medium (notifications) | 2 | Document rejection/approval alerts |
| Low (maintenance) | 1 | Cron cleanup, digest emails, data retention |

## Document processing pipeline reference

The main `processDocument` function has 5 steps in order:

1. **`ocr-extract`** — Claude AI extracts bill fields from image/PDF
2. **`validate-math`** — Checks subtotal + VAT ≈ grand total
3. **`classify`** — Determines direction, doc type, journal type
4. **`tax-gl-mapping`** — WHT detection + auto journal entry building
5. **`persist-results`** — Updates document + inserts journal lines

Status transitions after processing:
- Low quality / rotation issues → `QUERY`
- Pending match / unbalanced / manual review → `ACTION_REQUIRED`
- All checks pass → `PENDING_APPROVAL`

## Local development

```bash
# Start Inngest dev server (separate terminal)
npx inngest-cli@latest dev

# The dev server connects to your Next.js app at localhost:3000
# Dashboard available at localhost:8288
```

## Checklist before shipping

- [ ] Function has a unique `id` (kebab-case)
- [ ] Event name follows `"entity/action"` convention
- [ ] Registered in `src/app/api/inngest/route.ts`
- [ ] Steps are **idempotent** (safe to retry)
- [ ] Step IDs are unique within the function
- [ ] Retries set appropriately (1-3)
- [ ] Cron schedules use `TZ=Asia/Bangkok`
- [ ] DB queries filter by tenantId where applicable
- [ ] Return summary object for Inngest dashboard logging

## Pair with other skills

- **aicount-backend-api**: for API routes that send events
- **aicount-db-schema**: for tables the job reads/writes
- **thai-accounting-workflow**: for accounting pipeline logic
