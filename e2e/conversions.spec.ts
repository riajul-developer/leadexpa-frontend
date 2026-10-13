import { expect, test } from "@playwright/test";

// B-17.4 + GLOBAL_PROMPT 9.3 (step 5b): conversion feedback per client and ad spend sync.

test("a client's conversions tab shows destinations, stats and the delivery log", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByRole("link", { name: "Conversions" }).click();
  await expect(page.getByText("Meta and Google will learn which leads actually buy", { exact: false })).toBeVisible();
  await expect(page.getByText(/Accepted by/)).toBeVisible();

  const metaDest = page.getByRole("region", { name: "Meta: Dhaka Dental pixel" });
  await expect(metaDest.getByText("Healthy")).toBeVisible();
  await expect(metaDest.getByText(/Matched on/)).toBeVisible();
  await metaDest.getByRole("button", { name: "Delivery log" }).click();
  await expect(metaDest.getByText("Refused marketing").first()).toBeVisible();

  const google = page.getByRole("region", { name: "Google Ads: Dental Search" });
  await expect(google.getByText("Failing")).toBeVisible();
  await google.getByRole("button", { name: "Retry failed" }).click();
  await expect(page.getByText("2 events queued again")).toBeVisible();
});

test("adding a Meta destination needs the dataset and token; testing needs a test code", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByRole("link", { name: "Conversions" }).click();
  await page.getByRole("button", { name: "Add destination" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a destination" });
  await dialog.getByLabel("Dataset (pixel) ID").fill("777888999000");
  await dialog.getByLabel("Conversions API access token").fill("EAAB-test-token-0123456789");
  await dialog.getByRole("button", { name: "Add destination" }).click();
  await expect(page.getByText("Destination added")).toBeVisible();

  const dest = page.getByRole("region", { name: "Meta dataset 777888999000" });
  await dest.getByRole("button", { name: "Send a test" }).click();
  await expect(page.getByText("Add the test event code from Events Manager", { exact: false })).toBeVisible();
  await dest.getByRole("button", { name: "Events and settings" }).click();
  await dest.getByLabel("Test event code").fill("TEST4321");
  await dest.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await dest.getByRole("button", { name: "Send a test" }).click();
  await expect(page.getByText("Meta received 1 test event", { exact: false })).toBeVisible();
});

test("linking an ad account in another currency is refused; the right one syncs", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByRole("link", { name: "Campaigns" }).click();
  await expect(page.getByText("Dhaka Dental Ads")).toBeVisible();
  await page.getByRole("button", { name: "Link ad account" }).click();
  const dialog = page.getByRole("dialog", { name: "Link an ad account" });
  await dialog.getByLabel("Ad account").selectOption({ label: "US Dental Ads · USD" });
  await expect(dialog.getByText("Linking will be refused", { exact: false })).toBeVisible();
  await dialog.getByLabel("Platform").selectOption("google_ads");
  await dialog.getByLabel("Ad account").selectOption({ label: "Dental Search · BDT" });
  await dialog.getByRole("button", { name: "Link and sync" }).click();
  await expect(page.getByText("Account linked and synced")).toBeVisible();
  await expect(page.getByText("Dental Search").first()).toBeVisible();
});
