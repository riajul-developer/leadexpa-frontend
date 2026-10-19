import { expect, test } from "@playwright/test";

test("a client's CRMs show their state, and an unconfigured one can't be connected", async ({ page }) => {
  await page.goto("/en/integrations");
  await expect(page.getByRole("heading", { name: "CRM sync" })).toBeVisible();
  const card = page;
  await expect(card.getByText("HubSpot", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("listitem").filter({ hasText: "dhakadental.hubspot.com" }).getByText("Healthy"),
  ).toBeVisible();
  await expect(card.getByText("Not set up on this server yet").first()).toBeVisible();
  await expect(card.getByRole("button", { name: "Connect Salesforce" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Connect Pipedrive" })).toBeVisible();
});

test("connecting Pipedrive opens its sign-in and lists the connection", async ({ page }) => {
  await page.goto("/en/integrations");
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect Pipedrive" }).click();
  await (await popup).waitForEvent("close");
  await expect(page.getByText("CRM connected. New leads will sync from now on.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Pipedrive" })).toBeVisible();
});

test("the connection page edits rules and stages, syncs and shows the log", async ({ page }) => {
  await page.goto("/en/integrations");
  await page.getByRole("link", { name: "Manage HubSpot" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /HubSpot/ })).toBeVisible();
  await expect(page.getByText("128")).toBeVisible();

  // HubSpot contacts have no deal value.
  await expect(page.getByLabel("Direction for Deal value")).toBeDisabled();
  await page.getByLabel("Direction for Phone").selectOption("push");
  await expect(page.getByLabel("Conflict rule for Phone")).toBeDisabled();
  await page.getByRole("button", { name: "Save rules" }).click();
  await expect(page.getByText("Rules saved")).toBeVisible();

  await page.getByLabel("Won", { exact: true }).selectOption("CONNECTED");
  await page.getByRole("button", { name: "Save stages" }).click();
  await expect(page.getByText("Stages saved")).toBeVisible();

  await expect(page.getByText("Name: both changed, the CRM's value kept")).toBeVisible();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText("Synced", { exact: true })).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page).toHaveURL(/\/en\/integrations$/);
  await expect(page.getByRole("button", { name: "Connect HubSpot" })).toBeVisible();
});
