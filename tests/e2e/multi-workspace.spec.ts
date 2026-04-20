import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

// Assumes the seeded user already has one complete workspace.
// Creates a second workspace, aborts onboarding midway, confirms it appears
// as "Setup incomplete" in the selector, resumes, and completes it.
test("create second workspace → finish later → resume → complete", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "E2E_USER_EMAIL / E2E_USER_PASSWORD must be set");

  // Login
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard|\/select-workspace/);

  // Open the workspace selector → click Create New Workspace
  await page.locator('[title*="Workspace"], button:has-text("Select Client")').first().click().catch(() => {});
  await page.getByRole("button", { name: /Create New Workspace/i }).click();

  // Confirm dialog → Continue
  await expect(page.getByText(/Create a new workspace\?/i)).toBeVisible();
  await page.getByRole("button", { name: /Continue/i }).click();

  // /onboarding/workspace?new=true — fill minimum fields
  await page.getByLabel(/Company Name/i).fill("E2E Workspace B");
  await page.getByLabel(/Tax ID/i).fill("9988776655443");
  await page.getByRole("button", { name: /Next/i }).click();

  // Now on COA step — click "Finish later"
  await page.getByRole("button", { name: /Finish later/i }).click();
  await page.waitForURL(/\/(dashboard|$)/);

  // Re-open selector — expect "Setup incomplete" pill
  await page.locator('[title*="Workspace"], button:has-text("Select")').first().click();
  await expect(page.getByText(/Setup incomplete/i)).toBeVisible();

  // Switch to workspace B — should redirect to COA step (resume)
  await page.getByText("E2E Workspace B").click();
  await page.waitForURL(/\/onboarding\/chart-of-accounts/);

  // Blow through remaining steps by clicking their primary Next button
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: /Next|Save & Next|Continue/i }).first().click();
    await page.waitForLoadState("networkidle");
  }

  // Complete page
  await page.getByRole("button", { name: /Go to Dashboard|Finish/i }).click();
  await page.waitForURL(/\/dashboard/);

  // Re-open selector — pill for B should be gone
  await page.locator('[title*="Workspace"], button:has-text("Select")').first().click();
  await expect(page.getByText("E2E Workspace B")).toBeVisible();
  await expect(page.getByText(/Setup incomplete/i)).not.toBeVisible();
});
