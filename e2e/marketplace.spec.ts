import { expect, test } from "@playwright/test";

// GLOBAL_PROMPT 9.5 (step 5e): the app marketplace — browse and filter, set up built-ins, install a partner app
// with scope consent (key shown once), uninstall, and anonymous reviews.

test("the marketplace lists integrations and partner apps, filtered and searched", async ({ page }) => {
  await page.goto("/en/marketplace");
  await expect(page.getByRole("heading", { level: 1, name: "Marketplace" })).toBeVisible();
  await expect(page.getByRole("link", { name: /LeadSheet/ })).toBeVisible();
  await expect(page.getByText("Built in").first()).toBeVisible();
  await expect(page.getByText(/^marketplace./)).toHaveCount(0); // no raw translation keys
  await page.getByRole("button", { name: "CRM", exact: true }).click();
  await expect(page.getByRole("link", { name: /HubSpot/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /LeadSheet/ })).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search apps").fill("callpilot");
  await expect(page.getByRole("link", { name: /CallPilot/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /HubSpot/ })).toHaveCount(0);
});

test("a built-in listing opens its setup screen", async ({ page }) => {
  await page.goto("/en/marketplace/hubspot");
  await expect(page.getByText("Two-way sync with HubSpot contacts and lead status.")).toBeVisible();
  await page.getByRole("link", { name: "Manage" }).click();
  await expect(page).toHaveURL(/\/en\/integrations$/);
});

test("installing a partner app asks for consent, shows the key once, and can be undone", async ({ page }) => {
  await page.goto("/en/marketplace/leadsheet");
  await page.getByRole("button", { name: "Install" }).click();
  const dialog = page.getByRole("dialog", { name: "Install LeadSheet?" });
  await expect(dialog.getByText("webhooks:manage")).toBeVisible();
  const allow = dialog.getByRole("button", { name: "Allow and install" });
  await expect(allow).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await allow.click();
  const done = page.getByRole("dialog", { name: "LeadSheet is installed" });
  await expect(done.getByText(/^rkp\./)).toBeVisible();
  await done.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Installed", { exact: true })).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Uninstall" }).click();
  await expect(page.getByText("Uninstalled. The app's access was revoked.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Install" })).toBeVisible();
});

test("an agency rates an app; reviews stay anonymous", async ({ page }) => {
  await page.goto("/en/marketplace/leadsheet");
  await expect(page.getByText("An agency in AE")).toBeVisible();
  await page.getByRole("radio", { name: "4 stars" }).click();
  await page.getByLabel("Review text").fill("Clients check the sheet every morning.");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Review saved")).toBeVisible();
  await expect(page.getByText("Your agency", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Clients check the sheet every morning.").last()).toBeVisible();
});
