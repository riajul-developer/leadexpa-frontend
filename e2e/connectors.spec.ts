import { expect, test } from "@playwright/test";

test("adding a Google Ads connector shows the URL and key once", async ({ page }) => {
  await page.goto("/en/integrations");
  await page.getByRole("button", { name: "Add connector" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a connector" });
  await dialog.getByRole("radio", { name: /Google Ads/ }).check();
  await dialog.getByLabel("Name").fill("Google Ads: Whitening");
  await dialog.getByRole("button", { name: "Add connector" }).click();

  const ready = page.getByRole("dialog", { name: "Google Ads: Whitening is ready" });
  await expect(ready.getByText("the key is shown only once", { exact: false })).toBeVisible();
  await expect(ready.getByText("Webhook URL", { exact: true })).toBeVisible();
  await expect(ready.getByRole("button", { name: "Copy Key" })).toBeVisible();
  await ready.getByRole("link", { name: "Open health page" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Google Ads: Whitening/ })).toBeVisible();
  await expect(page.getByText("Waiting for first lead")).toBeVisible();
});

test("the health page lists deliveries and previews test leads", async ({ page }) => {
  await page.goto("/en/integrations");
  await page.getByRole("link", { name: /Google Ads: Implant search/ }).click();
  await expect(page.getByText("Healthy").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent deliveries" })).toBeVisible();
  await page.getByText("Fields after mapping").click();
  await expect(page.getByText("FirstName LastName")).toBeVisible();
});

test("a failing webhook can be re-mapped and paused", async ({ page }) => {
  await page.goto("/en/integrations");
  await page.getByRole("link", { name: /Typeform: Site visit booking/ }).click();
  await expect(page.getByText("Failing").first()).toBeVisible();
  await expect(page.getByText("No phone or email in the submission.").first()).toBeVisible();

  await page.getByRole("button", { name: "Add mapping" }).click();
  await page.getByLabel("Incoming field 4").fill("answers.2.email");
  await page.getByLabel("Lead field for row 4").selectOption("email");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
});
