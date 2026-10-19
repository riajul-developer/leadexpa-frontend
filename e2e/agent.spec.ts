import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/bn/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "ইনবক্স" })).toBeVisible();
});

test("inbox shows urgency sections with live SLA chips", async ({ page }) => {
  await expect(page.getByRole("button", { name: /সময় পেরিয়েছে/ }).first()).toBeVisible();
  // Overdue chips carry text and an icon, never color alone.
  const overdue = page.locator('[data-sla="overdue"]').first();
  await expect(overdue).toBeVisible();
  await expect(overdue).toContainText("সময় পেরিয়েছে");
});

test("log an outcome in one tap: the SLA turns met immediately", async ({ page }) => {
  const card = page
    .locator("article")
    .filter({ has: page.locator('[data-sla="overdue"]') })
    .first();
  const name = await card.getAttribute("aria-label");
  await card.getByRole("button", { name: "লগ" }).click();
  await expect(page.getByRole("dialog")).toContainText("কেমন হলো?");
  await page.getByRole("button", { name: "কথা হয়েছে" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const after = page.locator("article", { hasText: name ?? "" }).first();
  await expect(after.locator('[data-sla="met"]')).toBeVisible();
});

test("AI drafts a Bangla WhatsApp message, editable before sending", async ({ page }) => {
  await page.locator("article").first().locator("button").first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("tab", { name: "AI" }).click();
  await expect(sheet.getByText("AI-এর পরামর্শ — পাঠানোর আগে দেখে নিন")).toBeVisible();
  await sheet.getByRole("button", { name: "AI দিয়ে লিখুন" }).click();
  const variant = sheet.getByRole("textbox", { name: "বিকল্প 1" });
  await expect(variant).toHaveValue(/আসসালামু আলাইকুম/);
  await variant.fill("আসসালামু আলাইকুম, আজ বিকেলে কথা বলা যাবে?");
  await expect(sheet.getByText("সম্পাদিত")).toBeVisible();
  // Stub wa.me: it redirects off-site, and tests must not depend on the network.
  await page.context().route("https://wa.me/**", (route) => route.fulfill({ contentType: "text/html", body: "ok" }));
  const popup = page.waitForEvent("popup");
  await sheet.getByRole("button", { name: "WhatsApp-এ খুলুন" }).first().click();
  expect((await popup).url()).toContain("wa.me");
});

test("move a qualified lead to won with a sale (Bangla digits)", async ({ page }) => {
  await page.goto("/bn/leads?stage=qualified");
  await page.locator("tbody tr").first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "বিক্রি হয়েছে" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "বিক্রির পরিমাণ" });
  await dialog.getByRole("textbox").fill("৫,০০০");
  await dialog.getByRole("button", { name: "বিক্রিসহ সম্পন্ন" }).click();
  await expect(dialog).toBeHidden();
  await expect(sheet.getByText("বিক্রি হয়েছে").first()).toBeVisible();
});

test("English locale works end to end", async ({ page }) => {
  await page.goto("/en/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await expect(page.locator('[data-sla="overdue"]').first()).toContainText("Overdue");
});
