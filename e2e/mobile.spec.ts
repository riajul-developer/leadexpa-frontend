import { expect, test } from "@playwright/test";

test("bottom navigation and one-tap actions on a phone", async ({ page }) => {
  await page.goto("/bn/inbox");
  const nav = page.getByRole("navigation", { name: "প্রধান মেনু" }).last();
  await expect(nav.getByRole("link", { name: "ইনবক্স" })).toBeVisible();
  const call = page.getByRole("link", { name: /কল করুন$/ }).first();
  await expect(call).toHaveAttribute("href", /^tel:\+880/);
  const box = await call.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
});

test("quick add a walk-in lead with Bangla digits", async ({ page }) => {
  await page.goto("/bn/inbox");
  await page.getByRole("button", { name: "লিড যোগ করুন" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ফোন", { exact: true }).fill("০১৭১১-২২৩৩৪৪");
  await dialog.getByLabel("নাম", { exact: true }).fill("করিম হাসান");
  await dialog.getByText("সরাসরি এসেছেন").click();
  await dialog.getByRole("button", { name: "লিড যোগ করুন" }).click();
  await expect(page).toHaveURL(/\/bn\/leads\//);
  await expect(page.getByRole("heading", { level: 1, name: "করিম হাসান" })).toBeVisible();
});

test("the More sheet opens from the bottom navigation", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the bottom navigation is phone-only");
  await page.goto("/bn/inbox");
  await page.getByRole("navigation", { name: "প্রধান মেনু" }).last().getByRole("button", { name: "আরও" }).click();
  const sheet = page.getByRole("dialog", { name: "আরও" });
  await expect(sheet.getByRole("link", { name: "সেটিংস" })).toBeVisible();
});
