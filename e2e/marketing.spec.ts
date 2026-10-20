import { expect, test } from "@playwright/test";

test("the landing page explains the product and leads to sign-up", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: "Never lose a lead again." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From first click to closed sale, in one flow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simple plans that grow with your agency" })).toBeVisible();
  await expect(page.getByText("৳2,990")).toBeVisible();
  await page.getByText("Does it work in Bangla?").click();
  await expect(page.getByText("each lead is answered in their own language", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Start your 14-day free trial" }).click();
  await expect(page).toHaveURL(/\/en\/signup/);
});

test("the features page lists every group, and the language switcher keeps the page", async ({ page }) => {
  await page.goto("/en/features");
  await expect(page.getByRole("heading", { level: 1, name: "Everything LeadExpa does, in one place" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Security and admin" })).toBeVisible();
  const footer = page.getByRole("contentinfo");
  await footer.getByLabel("Language").click();
  await footer.getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar\/features$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "كل ما يقدمه LeadExpa في مكان واحد" })).toBeVisible();
});

test("signed-in visitors still see the landing page, with a link to their inbox", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "recov_csrf", value: "x", url: baseURL ?? "http://localhost:3100" }]);
  await page.goto("/en");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1, name: "Never lose a lead again." })).toBeVisible();
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Open your inbox" })).toHaveAttribute("href", "/en/inbox");
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});
