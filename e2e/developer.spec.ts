import { expect, test } from "@playwright/test";

test("an API key is created with scopes, shown once, and can be revoked", async ({ page }) => {
  await page.goto("/en/settings/developer");
  await expect(page.getByRole("heading", { name: "API keys" })).toBeVisible();
  await expect(page.getByText("HubSpot sync")).toBeVisible();

  await page.getByRole("button", { name: "New API key" }).click();
  const dialog = page.getByRole("dialog", { name: "New API key" });
  await dialog.getByLabel("Name").fill("Make scenario");
  await dialog.getByLabel(/leads:write/).check();
  await dialog.getByRole("button", { name: "90 days" }).click();
  await dialog.getByRole("button", { name: "Create key" }).click();

  const created = page.getByRole("dialog", { name: "Your new API key" });
  await expect(created.getByText("won't be shown again", { exact: false })).toBeVisible();
  await expect(created.getByText(/^rkp\./)).toBeVisible();
  await created.getByRole("button", { name: "Done" }).click();

  const row = page.getByRole("listitem").filter({ hasText: "Make scenario" });
  await expect(row.getByText("leads:write")).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await row.getByRole("button", { name: "Revoke" }).click();
  await expect(row.getByText("Revoked")).toBeVisible();
});

test("a webhook shows its delivery log, sends a test and resends a failed delivery", async ({ page }) => {
  await page.goto("/en/settings/developer");
  await page.getByRole("button", { name: /hooks\.zapier\.com/ }).click();
  const log = page.getByRole("region", { name: "Delivery log" });
  await expect(log.getByRole("button", { name: /Retrying · 500 Stage changed/ })).toBeVisible();

  await page.getByRole("button", { name: "Send test" }).click();
  await expect(page.getByText("Test delivered (200)")).toBeVisible();
  await expect(log.getByText("Test event")).toBeVisible();

  await log.getByRole("button", { name: "Retrying", exact: true }).click();
  await log.getByRole("button", { name: /Stage changed/ }).click();
  const detail = page.getByRole("dialog", { name: "Stage changed" });
  await expect(detail.getByText("the endpoint answered 500")).toBeVisible();
  await expect(detail.getByText("What we sent")).toBeVisible();
  await detail.getByRole("button", { name: "Resend" }).click();
  await expect(page.getByText("Resent and delivered")).toBeVisible();
});

test("adding a webhook checks the address and shows the signing secret once", async ({ page }) => {
  await page.goto("/en/settings/developer");
  await page.getByRole("button", { name: "Add webhook" }).click();
  const dialog = page.getByRole("dialog", { name: "Add webhook" });
  await dialog.getByLabel("Address (URL)").fill("https://crm.example.com/hooks/leadexpa");
  await dialog.getByLabel("Sale recorded").check();
  await dialog.getByRole("button", { name: "Add webhook" }).click();
  const created = page.getByRole("dialog", { name: "Webhook added" });
  await expect(created.getByText(/^whsec_/)).toBeVisible();
  await created.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: /crm\.example\.com/ })).toBeVisible();
});
