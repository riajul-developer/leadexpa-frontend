import { expect, test } from "@playwright/test";

// Tier 3 white-label + client portal (step 8f-1): the agency's brand (readable colours only, a logo), the portal's
// branded sign-in page, and the client's view of their own results and approved reviews.

// A 1×1 PNG.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63f80f0000010100051" +
    "8d84e0000000049454e44ae426082",
  "hex",
);

test("set the brand: unreadable colours are blocked, the preview follows, a logo is added", async ({ page }) => {
  await page.goto("/en/settings/branding");
  await expect(page.getByRole("heading", { name: "Your brand" })).toBeVisible();
  await page.getByLabel("Brand name").fill("Bright Growth");
  const primary = page.getByRole("textbox", { name: "Main colour" });
  await primary.fill("#FFD700");
  await expect(page.getByText("White text on this colour is hard to read.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save brand" })).toBeDisabled();
  await primary.fill("#1E3A8A");
  await expect(page.getByText("Contrast with white:", { exact: false })).toBeVisible();
  await expect(page.getByTestId("brand-preview").getByText("Welcome to Bright Growth")).toBeVisible();
  await page.getByLabel("Support email").fill("help@bright.test");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.getByText("Brand saved")).toBeVisible();

  await page.locator("#brand-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByTestId("brand-preview").getByRole("img", { name: "Bright Growth" })).toBeVisible();
  await expect(page.getByText("/p/demo-digital")).toBeVisible();

  // The client portal's sign-in page carries the brand.
  await page.goto("/en/p/demo-digital");
  await expect(page.getByRole("heading", { name: "Sign in to Bright Growth" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Bright Growth" })).toBeVisible();
  await expect(page.getByRole("link", { name: "help@bright.test" })).toBeVisible();
  await expect(page.locator("[data-brand]").first()).toHaveAttribute("style", /--color-primary: #1e3a8a/);
});

test("the portal: results and approved reviews, nothing else", async ({ page }) => {
  await page.goto("/en/portal");
  await expect(page.getByRole("heading", { name: /your results/ })).toBeVisible();
  const kpis = page.getByTestId("portal-kpis");
  await expect(kpis.getByText("Leads received")).toBeVisible();
  await expect(kpis.getByText("Sales won")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business reviews" })).toBeVisible();
  await expect(page.getByTestId("review-document")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});

test("an unknown portal link says so", async ({ page }) => {
  await page.goto("/bn/p/no-such-agency");
  await expect(
    page.getByRole("heading", { name: "এই সাইন-ইন পেজটি নেই। আপনার এজেন্সির পাঠানো লিংকটি দেখুন।" }),
  ).toBeVisible();
});
