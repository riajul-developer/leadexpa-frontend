import { expect, test } from "@playwright/test";

test("forwarded emails that need a person are accepted or rejected in the review queue", async ({ page }) => {
  await page.goto("/en/inbox");
  const link = page
    .getByRole("navigation", { name: "Main navigation" })
    .first()
    .getByRole("link", { name: /Needs review/ });
  await expect(link).toContainText("2");
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: "Needs review" })).toBeVisible();

  await expect(page.getByText("Please call me on 01712-345678 after 5pm.")).toBeVisible();
  await expect(page.getByLabel("Phone")).toHaveValue("+8801712345678");
  await expect(page.getByText("45% sure")).toBeVisible();
  await page.getByLabel("Name").fill("Farhana Akter");
  await page.getByRole("button", { name: "Create lead" }).click();
  await expect(page.getByText("Lead created")).toBeVisible();

  await expect(page.getByLabel("Name")).toHaveValue("Omar Haddad");
  await page.getByRole("button", { name: "Not a lead" }).click();
  await expect(page.getByText("Nothing to review")).toBeVisible();
});

test("a client's email forwarding address can be copied with a setup guide", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByRole("link", { name: "Sources" }).click();
  await expect(page.getByText(/^leads\+[0-9a-f]+@in\.recov\.app$/).first()).toBeVisible();
  await page.getByRole("button", { name: "Setup guide" }).click();
  const dialog = page.getByRole("dialog", { name: "Forward enquiry emails" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Forwarding address")).toHaveValue(/^leads\+/);
});

test("a Messenger lead shows its messages and the 24-hour window", async ({ page }) => {
  await page.goto("/en/leads?q=Sadia");
  await page.locator("tbody tr").filter({ hasText: "Sadia Islam" }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Messenger · free-form replies for", { exact: false })).toBeVisible();
  await expect(sheet.getByText("Messenger message").first()).toBeVisible();
  await expect(sheet.getByText("আমার নম্বর ০১৭১১২২৩৩৪৪")).toBeVisible();
});
