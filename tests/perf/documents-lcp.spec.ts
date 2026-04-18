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

      // Login page redirects to "/" which then routes based on onboarding state.
      // Wait until we're off /login, then for networkidle.
      try {
        await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
          timeout: 20_000,
        });
      } catch (e) {
        // Dump on-page error for diagnosis
        const errorText = await page
          .locator("text=/incorrect|invalid|failed|wrong|rate limit/i")
          .first()
          .textContent()
          .catch(() => null);
        throw new Error(
          `Login didn't navigate away from /login within 20s. ` +
            `On-page error: ${errorText ?? "(none visible)"}. ` +
            `Check credentials in .env.local — they must be valid for the ACTIVE environment ` +
            `(staging vs prod). Original error: ${(e as Error).message}`
        );
      }
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

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

      console.log(`  Run ${i + 1}/${RUNS}: landed on ${page.url()} after login`);

      // 2. Install a PerformanceObserver BEFORE navigating so we see the LCP
      //    event during the /documents navigation. getEntriesByType works
      //    only within the same document; since page.goto creates a new
      //    document, we inject the observer via page.addInitScript.
      await page.addInitScript(() => {
        (window as unknown as { __lcp: number }).__lcp = 0;
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const last = entries[entries.length - 1];
          if (last) {
            (window as unknown as { __lcp: number }).__lcp = last.startTime;
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });

      // Navigate to /documents — this is what we're measuring
      await page.goto("/documents", { waitUntil: "load" });

      // Wait for first row (or empty-state) to indicate the page is done rendering
      await page
        .locator("table tbody tr, [class*='empty'], text=/no documents/i")
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => {});

      // Give the browser a beat to finalize LCP entries
      await page.waitForTimeout(500);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(200);

      // 3. Read LCP from the observer we injected
      const lcp = await page.evaluate(
        () => (window as unknown as { __lcp: number }).__lcp || 0
      );

      if (typeof lcp === "number" && lcp > 0) {
        samples.push(lcp);
        console.log(`  Run ${i + 1}/${RUNS}: LCP = ${lcp.toFixed(0)} ms (url: ${page.url()})`);
      } else {
        const rowCount = await page.locator("table tbody tr").count();
        console.log(
          `  Run ${i + 1}/${RUNS}: LCP not captured. url=${page.url()} rows=${rowCount}`
        );
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
