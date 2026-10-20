import { expect, test } from "@playwright/test";

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

test("subscribe to email updates, confirm from the email, and unsubscribe", async ({ page }) => {
  await page.goto("/en/status");
  const form = page.getByRole("region", { name: "Get email updates" });
  await expect(form).toBeVisible();
  await form.getByRole("textbox", { name: "Email" }).fill("ops@example.com");
  await form.getByRole("checkbox").first().click();
  await form.getByRole("button", { name: "Subscribe" }).click();
  await expect(form.getByText("Check ops@example.com and open the link to confirm.")).toBeVisible();

  await page.goto("/en/status/subscribe?token=mock-confirm");
  await expect(page.getByRole("heading", { level: 1, name: "Confirm email updates" })).toBeVisible();
  await expect(page.getByText("You're subscribed.", { exact: false })).toBeVisible();
  await page.goto("/en/status/subscribe?token=expired");
  await expect(page.getByText("This link is invalid or has expired.", { exact: false })).toBeVisible();

  await page.goto("/bn/status/unsubscribe?token=mock-unsubscribe");
  await expect(page.getByRole("heading", { level: 1, name: "আনসাবস্ক্রাইব" })).toBeVisible();
  await expect(page.getByText("আপনি আনসাবস্ক্রাইব করেছেন।", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "স্ট্যাটাস পেজে ফিরে যান" }).click();
  await expect(page).toHaveURL(/\/bn\/status$/);
});
