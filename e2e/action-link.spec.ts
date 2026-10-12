import { expect, test } from "@playwright/test";

// BACKEND_PROMPT 17.0.3: a manager shares a no-login link to one lead; client staff open it, call, and record
// the outcome in one tap.

test("share an action link and log an outcome without signing in", async ({ page }) => {
  await page.goto("/en/leads?stage=new");
  const rows = page.locator("tbody tr").filter({ hasNotText: "Junk" });
  await expect(rows.first()).toBeVisible();
  const sheet = page.getByRole("dialog");
  const create = sheet.getByRole("button", { name: "Create link" });

  // Unassigned leads have no link (it acts as the owner), and do-not-contact leads have no call button: open
  // rows until one fits.
  let found = false;
  for (let i = 0; i < 5 && !found; i++) {
    await rows.nth(i).click();
    await sheet.getByRole("tab", { name: "Info" }).click();
    await expect(sheet.getByRole("heading", { name: "Consent" })).toBeVisible();
    found = (await create.isVisible()) && !(await sheet.getByText(/This lead asked not to be contacted/).isVisible());
    if (!found) await page.keyboard.press("Escape");
  }
  expect(found).toBe(true);

  await create.click();
  const input = sheet.getByRole("textbox", { name: "Action link" });
  await expect(input).toHaveValue(/\/en\/t\/mock-/);
  await expect(sheet.getByRole("link", { name: "Send on WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/\?text=/,
  );
  const url = new URL(await input.inputValue());

  await page.goto(url.pathname);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute("href", /^tel:\+/);
  // No app shell on this page.
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);

  await page.getByRole("button", { name: "I called" }).click();
  await page.getByRole("button", { name: "Talked" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. Thank you!");
});

test("expired and unknown links explain what to do", async ({ page }) => {
  await page.goto("/en/t/mock-expired");
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  await expect(page.getByText("Ask your manager to send a new one.")).toBeVisible();

  await page.goto("/bn/t/not-a-real-token");
  await expect(page.getByRole("heading", { name: "এই লিংকটি আর কাজ করে না" })).toBeVisible();
});
