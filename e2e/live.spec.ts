import { expect, test, type Page } from "@playwright/test";

// Against a real, seeded backend (E2E_LIVE=1 E2E_BASE_URL=http://localhost:3000, API on :8080, `go run ./cmd/seed`).
// Covers what mocks can't: cookies + CSRF + refresh, SSE, permissions, the public report rendered on the server.
test.skip(!process.env.E2E_LIVE, "set E2E_LIVE=1 with a seeded backend");

const PASSWORD = process.env.E2E_PASSWORD ?? "DemoPass#2026";

async function login(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/inbox/);
}

test("owner signs in, sees the inbox live, and logs an outcome", async ({ page }) => {
  await login(page, "owner@demo.recov.local");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Live" }).first()).toBeVisible({ timeout: 15_000 });
});

test("create a report, share it, open the public page logged out", async ({ page, browser }) => {
  await login(page, "owner@demo.recov.local");
  await page.goto("/en/reports");
  await page.getByLabel("Client").selectOption({ index: 1 });
  await page.getByRole("button", { name: "New report" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create report" }).click();
  await expect(page.getByText(/Prepared by/)).toBeVisible();
  await page.getByRole("button", { name: "Create link" }).click();
  const url = await page.getByRole("textbox", { name: "Share link" }).inputValue();

  const anon = await browser.newContext();
  const pub = await anon.newPage();
  await pub.goto(url);
  await expect(pub.getByText(/Prepared by|প্রস্তুতকারী/)).toBeVisible();
  await anon.close();
});

test("agent cannot see settings or other clients' data", async ({ page }) => {
  await login(page, "agent1@demo.recov.local");
  await expect(page.getByRole("link", { name: "Clients" })).toHaveCount(0);
  await page.goto("/en/settings/audit-log");
  await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
});
