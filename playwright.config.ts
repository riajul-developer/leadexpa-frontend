import { defineConfig, devices } from "@playwright/test";

// E2E (FRONTEND_PROMPT §12). Default: the app on MSW mock data (no backend needed).
// E2E_BASE_URL + E2E_LIVE=1 point the "live" spec at a running app with a seeded backend.
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { baseURL, trace: "retain-on-failure", locale: "bn-BD", timezoneId: "Asia/Dhaka" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /live\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
    { name: "live", use: { ...devices["Desktop Chrome"] }, testMatch: /live\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build:mock && pnpm exec next start -p ${PORT}`,
        url: `http://localhost:${PORT}/bn/login`,
        timeout: 600_000,
        reuseExistingServer: !process.env.CI,
        env: { NEXT_PUBLIC_API_MOCKING: "enabled", NEXT_PUBLIC_API_URL: "http://localhost:8080", NEXT_DIST_DIR: ".next-e2e" },
      },
});
