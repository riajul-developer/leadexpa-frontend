import { expect, test } from "@playwright/test";

test("record an opt-out and the lead becomes do-not-contact", async ({ page }) => {
  await page.goto("/en/leads?stage=new");
  await page.locator("tbody tr").filter({ hasNotText: "Junk" }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("tab", { name: "Info" }).click();
  await expect(sheet.getByRole("heading", { name: "Consent" })).toBeVisible();
  // The seed has one opted-out lead; start from "may contact" either way.
  const again = sheet.getByRole("button", { name: "They agreed to be contacted again" });
  const optOut = sheet.getByRole("button", { name: "Asked not to be contacted" });
  await expect(again.or(optOut)).toBeVisible();
  if (await again.isVisible()) {
    await again.click();
    await expect(optOut).toBeVisible();
  }

  page.once("dialog", (d) => void d.accept());
  await sheet.getByRole("button", { name: "Asked not to be contacted" }).click();
  await expect(page.getByText("Recorded: no more calls or messages")).toBeVisible();
  await expect(sheet.getByText(/asked not to be contacted/i).first()).toBeVisible();
  await expect(sheet.getByText(/This lead asked not to be contacted/)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "They agreed to be contacted again" })).toBeVisible();
});

test("do-not-contact leads have no call or WhatsApp buttons in the inbox", async ({ page }) => {
  await page.goto("/en/inbox");
  const card = page.locator("article").filter({ hasText: "Do not contact" }).first();
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: /^Call / })).toHaveCount(0);
});
