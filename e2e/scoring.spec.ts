import { expect, test } from "@playwright/test";

test("a lead's score explains itself and takes feedback", async ({ page }) => {
  await page.goto("/en/leads");
  await expect(page.locator("[data-score]").first()).toBeVisible();
  await page.locator("tbody tr").first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: /^Score \d+: why\?$/ }).click();
  await expect(page.getByText(/(Hot|Warm|Cold) lead · \d+\/100/)).toBeVisible();
  await expect(page.getByText("Model rules-v1")).toBeVisible();
  await page.getByRole("button", { name: "Too low" }).click();
  await expect(page.getByText("Thanks. This helps the score learn.")).toBeVisible();
});

test("the inbox sorts by urgency × score", async ({ page }) => {
  await page.goto("/en/inbox");
  const sort = page.getByRole("combobox", { name: "Sort" });
  await sort.selectOption("score");
  await expect(sort).toHaveValue("score");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("score", { timeout: 10000 });
});

test("smart routing: settings, weights and the decision log", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByLabel("Lead assignment").selectOption("smart");
  await expect(page.getByText("Send hot leads to the fastest responder")).toBeVisible();
  await page.getByLabel("Max open leads per agent").fill("25");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: false }).first()).toBeVisible();

  await page.getByRole("link", { name: "Team" }).click();
  await expect(page.getByRole("columnheader", { name: "Weight" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Routing decisions" })).toBeVisible();
  await expect(page.locator("[data-rule]").first()).toBeVisible();
});

test("members' routing skills and the scoring page", async ({ page }) => {
  await page.goto("/en/settings/team");
  await expect(page.getByRole("heading", { name: "Routing skills" })).toBeVisible();
  const row = page.locator("[data-member]").first();
  await row.getByLabel("Languages").fill("bn, en, ar");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Skills saved")).toBeVisible();

  await page.goto("/en/settings/scoring");
  await expect(page.getByRole("heading", { name: "Lead scoring" })).toBeVisible();
  await expect(page.getByText("Closed leads to learn from")).toBeVisible();
  await expect(page.locator('[data-feature="campaign_rate"]')).toContainText("Campaign's win rate");
  await page.getByRole("button", { name: "Train now" }).click();
  await expect(page.getByText(/Not enough closed leads yet/)).toBeVisible();
});
