import { test, expect } from "@playwright/test";

/**
 * Measures LCP on /documents across N runs and prints the median.
 *
 * Setup:
 *   1. npx playwright install chromium   (one-time)
 *   2. Add to .env.local (or export in shell):
 *        E2E_USER_EMAIL=<your test account email on the active environment>
 *        E2E_USER_PASSWORD=<password>
 *   3. Start the server you want to measure (prod mode recommended):
 *        npm run build && npm start
 *   4. Run: npm run test:perf
 *
 * Workflow for pre/post comparison:
 *   - Run on current branch, note median.
 *   - `git checkout <pre-task0-commit>` → npm install → npm run build && npm start
 *   - Run again, note median.
 *   - Compute improvement = (base - post) / base; target ≥ 0.30.
 *
 * Requirements for the test user:
 *   - Must have AT LEAST ONE tenant assignment so login sets the cookie
 *     automatically (new single-tenant default) OR workspace is already
 *     selected in a prior session.
 *   - Should have a few documents in that tenant so the /documents list
 *     has a real first-contentful element (otherwise LCP measures an
 *     empty-state text node, which skews the comparison).
 *
 * Notes:
 *   - Each run uses a FRESH browser context → no shared cache, no shared
 *     cookies. This mirrors the "cold navigation" scenario the prefetch
 *     change is optimizing.
 *   - LCP is finalized by dispatching a Tab key. Chrome stops updating LCP
 *     on first user interaction; without this, `performance.getEntries`
 *     may return a partial value.
 */

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;
const RUNS = Number(process.env.PERF_RUNS ?? 5);

test.describe.configure({ mode: "serial" });

test(`measure /documents LCP over ${RUNS} runs`, async ({ browser }) => {
  test.skip(!EMAIL || !PASSWORD, "E2E_USER_EMAIL / E2E_USER_PASSWORD must be set");

  const samples: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // 1. Log in
      await page.goto("/login");
      await page.getByLabel("Email").fill(EMAIL!);
      await page.getByLabel("Password").fill(PASSWORD!);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15_000 });

      // If there's no workspace cookie yet (multi-tenant user), pick the first
      // workspace from the selector to set one. For single-tenant users the
      // login route sets the cookie automatically.
      const selectClientBtn = page.getByRole("button", { name: /select client/i });
      if (await selectClientBtn.isVisible().catch(() => false)) {
        await selectClientBtn.click();
        // Click the first workspace in the dropdown
        await page
          .locator("[role='button'], button")
          .filter({ hasText: /^[A-Z]/ })
          .first()
          .click({ trial: false })
          .catch(() => {});
        await page.waitForLoadState("networkidle").catch(() => {});
      }

      // 2. Navigate to /documents — this is what we're measuring
      await page.goto("/documents");

      // Wait for either a row or an empty-state marker
      await page
        .locator("table tbody tr, [data-empty], text=/no documents/i")
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});

      // Trigger LCP finalization (Chrome stops updating LCP on first interaction)
      await page.keyboard.press("Tab");

      // 3. Read LCP entries
      const lcp = await page.evaluate(() => {
        const entries = performance.getEntriesByType(
          "largest-contentful-paint"
        ) as PerformanceEntry[];
        if (entries.length === 0) return null;
        return entries[entries.length - 1].startTime;
      });

      if (typeof lcp === "number" && lcp > 0) {
        samples.push(lcp);
        console.log(`  Run ${i + 1}/${RUNS}: LCP = ${lcp.toFixed(0)} ms`);
      } else {
        console.log(`  Run ${i + 1}/${RUNS}: LCP not captured`);
      }
    } finally {
      await context.close();
    }
  }

  if (samples.length === 0) {
    throw new Error(
      "No LCP samples captured. Check: (a) test user credentials work, " +
        "(b) /documents renders at least one row or an empty-state marker, " +
        "(c) the server is actually serving the branch you intended to measure."
    );
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  console.log("\n────────────────────────────────────────");
  console.log(`/documents LCP across ${samples.length} runs`);
  console.log(`  median: ${median.toFixed(0)} ms`);
  console.log(`  min:    ${min.toFixed(0)} ms`);
  console.log(`  max:    ${max.toFixed(0)} ms`);
  console.log(`  samples: ${sorted.map((s) => s.toFixed(0)).join(", ")} ms`);
  console.log("────────────────────────────────────────\n");

  expect(samples.length).toBeGreaterThan(0);
});
