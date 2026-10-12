import { expect, test } from "@playwright/test";

// FRONTEND_PROMPT 17.0.3: client staff sign in with an SMS code and work their leads from big cards; the agency
// sees an adoption card and invites staff by phone.

test("client staff sign in with a code and log an outcome from My leads", async ({ page }) => {
  await page.goto("/en/lite/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in with your phone" })).toBeVisible();
  await page.getByLabel("Mobile number").fill("01712345678");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Enter the code" })).toBeVisible();
  await expect(page.getByLabel("Keep me signed in on this phone")).toBeChecked();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That code isn't right or has expired.")).toBeVisible();
  await page.getByLabel("6-digit code").fill("১২৩৪৫৬");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "My leads" })).toBeVisible();
  const card = page.locator("article").first();
  await card.getByRole("button", { name: "I called" }).click();
  await card.getByRole("button", { name: "Talked" }).click();
  await expect(page.getByText("Saved. Thank you!")).toBeVisible();
});

test("the client overview shows the adoption card and reminds idle staff", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await expect(page.getByText("Client staff follow-up")).toBeVisible();
  await expect(page.getByText("14 of 41 leads")).toBeVisible();
  await page.getByRole("button", { name: "Remind inactive staff" }).click();
  await expect(page.getByText("1 person reminded by SMS")).toBeVisible();
});

test("client staff are invited by SMS for one client", async ({ page }) => {
  await page.goto("/en/settings/team");
  await page.getByRole("button", { name: "Invite" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Role").selectOption("client_agent");
  await expect(dialog.getByRole("radio", { name: "SMS" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByLabel("Client").selectOption({ label: "Dhaka Dental Care" });
  await dialog.getByLabel("Mobile number").fill("01712345678");
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(dialog.getByText("Invitation sent to 01712345678.")).toBeVisible();
});
