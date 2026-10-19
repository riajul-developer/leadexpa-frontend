import { expect, test } from "@playwright/test";

test("the Junk bucket lists junk leads and restores them", async ({ page }) => {
  await page.goto("/en/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await expect(page.locator("main").getByText("Junk", { exact: true })).toHaveCount(0);

  const junkLink = page
    .getByRole("navigation", { name: "Main navigation" })
    .first()
    .getByRole("link", { name: /Junk/ });
  await expect(junkLink).toContainText(/\d+/);
  await junkLink.click();
  await expect(page).toHaveURL(/quality=junk/);
  const firstRow = page.locator("tbody tr").filter({ hasText: "Junk" }).first();
  await expect(firstRow).toBeVisible();
  await expect(page.getByText("Junk leads aren't in the inbox")).toBeVisible();

  await firstRow.getByRole("checkbox").check();
  await expect(page.getByText("1 selected")).toBeVisible();
  await page.getByRole("button", { name: "Not junk → restore" }).click();
  await expect(page.getByText(/1 lead restored to the inbox/)).toBeVisible();
});

test("suspect leads show their reasons", async ({ page }) => {
  await page.goto("/en/leads?quality=suspect");
  const badge = page.locator("tbody").getByTitle("Placeholder or random name").first();
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("Suspect");
});

test("the outcome sheet offers Fake / junk", async ({ page }) => {
  await page.goto("/en/inbox");
  await page.getByRole("button", { name: /^Log$/ }).first().click();
  await expect(page.getByRole("button", { name: "Fake / junk" })).toBeVisible();
});

test("the dashboard ranks campaigns by junk rate", async ({ page }) => {
  await page.goto("/en/dashboard");
  await expect(page.getByRole("heading", { name: "Junk by campaign" })).toBeVisible();
  await expect(page.getByText(/\+ \d+ junk/)).toBeVisible();
});
