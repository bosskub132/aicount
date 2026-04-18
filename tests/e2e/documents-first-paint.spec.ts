import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

test("documents page renders rows before /api/documents fires", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "E2E_USER_EMAIL / E2E_USER_PASSWORD must be set");

  let initialApiCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/documents") && req.method() === "GET") {
      initialApiCalls++;
    }
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard|\/select-workspace/);

  initialApiCalls = 0;

  const navigation = page.goto("/documents");

  const firstRow = page.locator("table tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 10_000 });
  await navigation;

  expect(initialApiCalls, "/api/documents should not fire during initial render").toBe(0);
});
