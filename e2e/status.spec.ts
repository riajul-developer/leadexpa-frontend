import { expect, test } from "@playwright/test";

// The public status page (G7j): no login, every region's components with 90 days of uptime, current incidents,
// scheduled maintenance and the last 14 days, in the reader's language.

test("the public status page shows regions, uptime bars, incidents and maintenance", async ({ page }) => {
  await page.goto("/en/status");
  await expect(page.getByRole("heading", { level: 1, name: "LeadExpa status" })).toBeVisible();
  await expect(page.getByTestId("status-overall")).toHaveText("Some systems are degraded");
  const regions = page.getByTestId("status-region");
  await expect(regions).toHaveCount(2);
  const eu1 = regions.filter({ hasText: "eu1" });
  await expect(eu1.getByText("Degraded").first()).toBeVisible();
  await expect(page.getByRole("img", { name: "App and API, daily uptime for the last 90 days" })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Current incidents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Problems with lead capture" })).toBeVisible();
  await expect(page.getByText("Affects Lead capture in eu1")).toBeVisible();
  // Opened by the prober (ADR 0052), and labelled so.
  await expect(page.getByTestId("status-incident-automatic")).toHaveText("Detected automatically");
  await expect(page.getByRole("heading", { name: "Scheduled maintenance", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scheduled maintenance: messaging" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Past 14 days" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Problems with the app and API" })).toBeVisible();
  await expect(
    page.getByText("Availability targets: 99.9% standard, 99.95% enterprise", { exact: false }),
  ).toBeVisible();
});

test("the status page speaks the reader's language", async ({ page }) => {
  await page.goto("/ar/status");
  await expect(page.getByRole("heading", { level: 1, name: "حالة LeadExpa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "مشكلات في استقبال العملاء المحتملين" })).toBeVisible();
});
