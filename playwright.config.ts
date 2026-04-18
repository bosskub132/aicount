import { defineConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local so E2E_USER_EMAIL / E2E_USER_PASSWORD are available
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["e2e/**/*.spec.ts", "perf/**/*.spec.ts"],
  timeout: 300_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Override NEXT_PUBLIC_APP_URL so the server's CSRF check matches
        // the localhost origin the Playwright browser uses.
        command:
          process.platform === "win32"
            ? "set NEXT_PUBLIC_APP_URL=http://localhost:3000&& npm run dev"
            : "NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run dev",
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
