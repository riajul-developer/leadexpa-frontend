import { expect, test } from "@playwright/test";

// BACKEND_PROMPT 17.0.2 (step 6a): an agent requests a payment from a lead and shares the link; the lead pays on
// a no-login page; the client's Payments tab shows the merchant account, the links and the revenue they brought.

test("request a payment, share it, and the lead pays on the public page", async ({ page }) => {
  await page.goto("/en/leads");
  await page.locator("tbody tr").filter({ hasText: "Dhaka Dental Care" }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("tab", { name: "Sales" }).click();
  await sheet.getByRole("button", { name: "Request payment" }).click();

  const form = page.getByRole("dialog", { name: "Request payment" });
  await form.getByLabel("Amount").fill("5000");
  await form.getByRole("button", { name: "Advance" }).click();
  await form.getByRole("button", { name: "Create link" }).click();

  const ready = page.getByRole("dialog", { name: "Payment link ready" });
  await expect(ready.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/\d+\?text=.*pay/,
  );
  await expect(ready.getByText("Payments go directly to your client's account.", { exact: false })).toBeVisible();
  const link = (await ready.locator("code").textContent())!.trim();
  await ready.getByRole("button", { name: "Done" }).click();

  // The payer: no session, the client's name, the amount, one button.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Dhaka Dental Care" })).toBeVisible();
  await expect(page.getByText("Test payment: no real money moves")).toBeVisible();
  await page.getByRole("button", { name: "Pay with bKash" }).click();
  await expect(page.getByText("Payment received")).toBeVisible();
});

test("the client's Payments tab: account, links and revenue", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByRole("link", { name: "Payments" }).click();
  await expect(page.getByText("Revenue via payment links")).toBeVisible();
  await expect(page.getByText("Sandbox (test)")).toBeVisible();
  await expect(page.getByRole("switch")).toBeChecked();

  // Credentials are checked with the gateway before they're saved.
  await page.getByRole("button", { name: "Connect account" }).click();
  await page.getByLabel("Gateway").selectOption("sslcommerz");
  await page.getByLabel("Store ID").fill("dhakadental");
  await page.getByLabel("Store password").fill("wrong");
  await page.getByRole("button", { name: "Check and save" }).click();
  await expect(page.getByText("didn't accept these credentials", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Paid", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open lead" }).first()).toBeVisible();
});
