import { expect, test } from "@playwright/test";

// GLOBAL_PROMPT 10.3 (step 7f-1): revenue intelligence. Offline sales matched to leads with a review queue, a lead's
// likely deal value and close date, prediction accuracy under the forecast, and opt-in benchmarks.

test("offline sales: upload, then confirm or ignore what didn't match", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.locator("main").getByRole("link", { name: "Offline sales", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2 sales to review" })).toBeVisible();

  await page.locator("#offline-csv").setInputFiles({
    name: "pos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("order_id,amount,date,phone\nPOS-1,1500,2026-10-10,01711000000\n"),
  });
  await expect(page.getByTestId("offline-result")).toContainText("9 matched · 2 to review");

  const ambiguous = page.locator("[data-offline-sale]").filter({ hasText: "Several leads match" });
  await ambiguous.getByRole("button", { name: "It's this lead" }).first().click();
  await expect(page.getByText("Sale added to the lead")).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 sale to review" })).toBeVisible();
  await page.getByRole("button", { name: "Not one of our leads" }).click();
  await expect(page.getByText("Every sale found its lead.")).toBeVisible();
  await expect(page.getByText("Confirmed by your team")).toBeVisible();
});

test("a lead's likely deal, and how accurate predictions are", async ({ page }) => {
  await page.goto("/en/appointments");
  const href = (await page.locator("main a[href*='/leads/']").first().getAttribute("href")) ?? "";
  await page.goto(href.replace(/^\/(en|bn|ar)/, "/en"));
  await page.getByRole("tab", { name: "Sales" }).first().click();
  const card = page.getByTestId("lead-prediction").first();
  await expect(card.getByText("Likely value")).toBeVisible();
  await expect(card.getByText("Chance to win")).toBeVisible();
  await expect(card.getByText("Likely closes")).toBeVisible();

  await page.goto("/en/insights");
  await page.getByRole("tab", { name: "Forecast" }).click();
  const cal = page.getByTestId("calibration");
  await expect(cal.getByText("64 closed leads checked", { exact: false })).toBeVisible();
  await expect(cal.getByRole("table")).toBeVisible();
});

test("benchmarks appear after opting in, with the method shown", async ({ page }) => {
  await page.goto("/en/insights");
  await page.getByRole("tab", { name: "Benchmarks" }).click();
  const optIn = page.getByRole("switch", { name: /Share anonymous figures/ });
  await expect(optIn).not.toBeChecked();
  await optIn.click();
  await expect(page.getByText("Faster than 78% of agencies")).toBeVisible();
  await expect(
    page.locator('[data-benchmark="win_rate"]').getByText("Not enough agencies in this group yet"),
  ).toBeVisible();
  await expect(page.getByText("only its deciles are kept", { exact: false })).toBeVisible();
});
