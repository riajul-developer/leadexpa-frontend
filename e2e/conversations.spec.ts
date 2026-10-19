import { expect, test } from "@playwright/test";

test("reply to a WhatsApp conversation inside the 24-hour window", async ({ page }) => {
  await page.goto("/en/conversations");
  await expect(page.getByRole("heading", { level: 1, name: "Conversations" })).toBeVisible();
  const list = page.getByRole("list", { name: "Conversations" });
  await list.getByRole("button").first().click();
  await expect(page.getByText("Free-form replies allowed for", { exact: false })).toBeVisible();
  await expect(page.getByText("Implant, next week possible?").first()).toBeVisible();

  const box = page.getByLabel("Write a reply… (Ctrl+Enter to send)");
  await box.fill("Yes, Tuesday 4pm works. See you!");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("region", { name: /Conversation with/ }).getByText("Yes, Tuesday 4pm works. See you!"),
  ).toBeVisible();
  await expect(box).toHaveValue("");
});

test("outside the window only an approved template can be sent", async ({ page }) => {
  await page.goto("/en/conversations");
  await page.getByRole("list", { name: "Conversations" }).getByRole("button").nth(2).click();
  await expect(page.getByText("24-hour window closed: send an approved template")).toBeVisible();
  await page.getByLabel("Choose a template").selectOption({ label: "lead_welcome · en" });
  await page.getByRole("button", { name: "Send template" }).click();
  await expect(
    page.getByRole("region", { name: /Conversation with/ }).getByText(/Hi .+, thanks for contacting Dhaka Dental Care/),
  ).toBeVisible();
});

test("a colleague's reply lock is shown", async ({ page }) => {
  await page.goto("/en/conversations");
  await page.getByRole("list", { name: "Conversations" }).getByRole("button").nth(1).click();
  await expect(page.getByRole("status").filter({ hasText: "is replying…" })).toBeVisible();
});

test("a client's WhatsApp number and templates are managed on the Channels tab", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByRole("link", { name: "Channels" }).click();
  await expect(page.getByText("+880 1711-000000")).toBeVisible();
  await expect(page.getByText("Approved").first()).toBeVisible();
  await expect(page.getByText("Pending review")).toBeVisible();
});

test("the kill switch pauses all messaging", async ({ page }) => {
  await page.goto("/en/settings/messaging");
  await page.getByLabel("Pause all messaging").click();
  await expect(page.getByText("Messaging paused")).toBeVisible();
});

test("turn on the speed-to-lead auto-reply with a phone preview", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByRole("link", { name: "Channels" }).click();
  await expect(page.getByText("Speed-to-lead auto-reply")).toBeVisible();
  await expect(page.getByText(/About 120 new leads a month/)).toBeVisible();
  await page.getByLabel("Auto-reply on or off").click();
  await page.getByLabel("Template", { exact: true }).selectOption({ label: "lead_welcome · en" });
  await expect(page.getByText("Hi Karim, thanks for contacting Dhaka Dental Care.", { exact: false })).toBeVisible();
  await expect(page.getByText("আসসালামু আলাইকুম Karim", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Save auto-reply" }).click();
  await expect(page.getByText("Auto-reply is on")).toBeVisible();
  await expect(page.getByText("no WhatsApp consent")).toBeVisible();
});
