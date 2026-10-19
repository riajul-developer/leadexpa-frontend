import { expect, test } from "@playwright/test";

// Header overlays lazy-load; one click must still open them with focus inside.

test.beforeEach(async ({ page }) => {
  await page.goto("/bn/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "ইনবক্স" })).toBeVisible();
});

test("account menu opens on the first click", async ({ page }) => {
  await page.getByRole("button", { name: "অ্যাকাউন্ট মেনু" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "সাইন আউট" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: "অ্যাকাউন্ট মেনু" })).toBeFocused();
});

test("client filter opens on the first click and writes ?client=", async ({ page }) => {
  await page.getByRole("button", { name: "ক্লায়েন্ট ফিল্টার" }).click();
  await page.getByRole("menuitem", { name: "Dhaka Dental Care" }).click();
  await expect(page).toHaveURL(/client=/);
  await expect(page.getByRole("button", { name: "ক্লায়েন্ট ফিল্টার" })).toContainText("Dhaka Dental Care");
});

test("notifications open on the first click; the badge is live before that", async ({ page }) => {
  const bell = page.getByRole("button", { name: /নোটিফিকেশন, .+ অপঠিত/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "নোটিফিকেশন" })).toBeVisible();
});

test("keyboard shortcuts help opens with ?", async ({ page }) => {
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "কীবোর্ড শর্টকাট" })).toBeVisible();
});
