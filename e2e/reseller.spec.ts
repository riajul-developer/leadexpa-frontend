import { expect, test } from "@playwright/test";

// GLOBAL_PROMPT G3 (step 6c): an agency connects Stripe, prices a plan for its clients, shares a branded checkout
// link, and its client pays the agency's account; partners refer agencies and see their commission.

test("a reseller sells its own plan to a client", async ({ page }) => {
  await page.goto("/en/reseller");
  await expect(page.getByRole("heading", { name: "Reseller", level: 1 })).toBeVisible();
  await expect(page.getByText("Not connected")).toBeVisible();
  await expect(page.getByRole("button", { name: "New plan" })).toBeDisabled();

  await page.getByRole("button", { name: "Connect with Stripe" }).click();
  await expect(page.getByText("Welcome back. Your Stripe account is connected.")).toBeVisible();
  await expect(page).not.toHaveURL(/onboarding=/);
  await expect(page.getByText("Payments and payouts are on.")).toBeVisible();

  await page.getByRole("button", { name: "New plan" }).click();
  const planDialog = page.getByRole("dialog", { name: "New plan" });
  await planDialog.getByLabel("Plan name").fill("Local SEO retainer");
  await planDialog.getByLabel("What's included").fill("Monthly SEO and lead follow-up");
  await planDialog.getByLabel("Price").fill("5000");
  await planDialog.getByRole("button", { name: "Create plan" }).click();
  await expect(page.getByText("Plan created")).toBeVisible();
  await expect(page.locator('[data-plan="Local SEO retainer"]')).toBeVisible();

  await page.getByRole("button", { name: "New link" }).click();
  const linkDialog = page.getByRole("dialog", { name: "New link" });
  await linkDialog.getByLabel("For a client").selectOption({ label: "Dhaka Dental Care" });
  await linkDialog.getByRole("button", { name: "Create link" }).click();
  const ready = page.getByRole("dialog", { name: "Your link is ready" });
  const url = (await ready.locator("code").textContent())!.trim();
  expect(url).toMatch(/\/en\/buy\/mock[0-9a-f]+$/);
  await ready.getByRole("button", { name: "Done" }).click();

  // The client: no login, the agency's name and plan, and they pay the agency.
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Local SEO retainer" })).toBeVisible();
  await expect(page.getByText("You pay", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByText("Thank you!")).toBeVisible();

  // Back in the console: the sale, the customer and the earnings.
  await page.goto("/en/reseller");
  await expect(page.getByRole("heading", { name: "Earnings" })).toBeVisible();
  await expect(page.getByText("Net", { exact: true })).toBeVisible();
  await expect(page.locator('[data-kind="payment"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(page.locator(`[data-link="Local SEO retainer"]`).getByText(/· 1 sale/)).toBeVisible();
});

test("partners join, share a link and see commission", async ({ page }) => {
  await page.goto("/en/partners");
  await expect(page.getByRole("heading", { name: "Partner program", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Join the partner program" }).click();
  await expect(page.getByText("You're a partner.", { exact: false })).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "/signup?ref=" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Commission", exact: true })).toBeVisible();
  await expect(page.getByText("Ready to pay out")).toBeVisible();
  await expect(page.locator('[data-referral="Growth Lab Two"]').getByText("Not counted")).toBeVisible();
  await expect(page.locator('[data-kind="clawback"]')).toBeVisible();
});

test("a referral link says who sent you", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/en/signup?ref=lx7k2m9q");
  await expect(page.getByText("A partner sent you here.", { exact: false })).toBeVisible();
});
