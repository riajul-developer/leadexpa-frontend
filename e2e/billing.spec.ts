import { expect, test } from "@playwright/test";

// GLOBAL_PROMPT G2 (step 6b): an owner picks a plan priced in the agency's currency (tax noted), checks out on
// Stripe and comes back subscribed; invoices show tax; usage budgets alert at 80 % / 100 %.

test("choose a plan, check out, and come back subscribed", async ({ page }) => {
  await page.goto("/en/settings/billing");
  await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
  await expect(page.getByText("Prices exclude VAT", { exact: false })).toBeVisible();

  // Annual shows a year's price (10 months).
  const growth = page.locator('[data-plan="growth"]');
  await expect(growth.getByText("/ month", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Annual/ }).click();
  await expect(growth.getByText("/ year", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Monthly" }).click();

  await growth.getByRole("button", { name: "Choose Growth" }).click();
  await expect(page.getByText("Thank you! Your subscription is active.")).toBeVisible();
  await expect(page).not.toHaveURL(/checkout=/);
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await expect(growth.getByText("Your plan")).toBeVisible();

  // A paying agency switches plan instead of checking out again.
  await page.locator('[data-plan="pro"]').getByRole("button", { name: "Switch to Pro" }).click();
  await expect(page.getByText("You're now on Pro.")).toBeVisible();

  // The invoice shows tax separately.
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  await expect(page.getByText("LDX-0001")).toBeVisible();
  await expect(page.getByText(/incl\. .+ tax/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible();
});

test("usage meters and budgets", async ({ page }) => {
  await page.goto("/en/settings/billing");
  await expect(page.getByRole("heading", { name: "Usage this month" })).toBeVisible();
  const wa = page.locator('[data-meter="whatsapp_messages"]');
  await expect(wa.getByText(/of .+\(86%\)/)).toBeVisible();

  const ai = page.locator('[data-meter="ai_generations"]');
  await expect(ai.getByText("no budget", { exact: false })).toBeVisible();
  await ai.getByRole("button", { name: "Budget for AI generations" }).click();
  const dialog = page.getByRole("dialog", { name: "Budget: AI generations" });
  await dialog.getByLabel("Monthly limit").fill("50");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Budget saved")).toBeVisible();
  await expect(ai.getByText(/\(84%\)/)).toBeVisible();

  await ai.getByRole("button", { name: "Budget for AI generations" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove budget" }).click();
  await expect(ai.getByText("no budget", { exact: false })).toBeVisible();
});
