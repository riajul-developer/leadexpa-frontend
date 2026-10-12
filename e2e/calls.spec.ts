import { expect, test } from "@playwright/test";

// FRONTEND_PROMPT 17.8: calls. Recording + transcript + AI notes, click-to-call from the lead page, the power
// dialer, coaching, calling numbers on the client's Channels tab, and call settings.

test("a recorded call shows its transcript and AI notes, which can be applied to the lead", async ({ page }) => {
  await page.goto("/en/calls");
  await expect(page.getByRole("heading", { level: 1, name: "Calls" })).toBeVisible();
  await page.getByRole("list", { name: "Calls" }).getByRole("button").first().click();
  const call = page.getByRole("article", { name: /Call with/ });
  await expect(call.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(call.getByText("Saturday evening works.")).toBeVisible();
  await expect(call.getByText("AI call notes")).toBeVisible();
  await expect(call.getByText("Price too high")).toBeVisible();

  await call.getByLabel("Search the transcript").fill("EMI");
  await expect(call.getByText("Saturday evening works.")).toHaveCount(0);
  await expect(call.getByText(/EMI plan over six months/)).toBeVisible();

  await call.getByRole("button", { name: /Apply/ }).click();
  await expect(page.getByText("Notes added to the lead")).toBeVisible();
});

test("click-to-call from a lead logs the call when it ends", async ({ page }) => {
  await page.goto("/en/calls");
  await page.getByRole("list", { name: "Calls" }).getByRole("button").first().click();
  await page
    .getByRole("article", { name: /Call with/ })
    .getByRole("heading", { level: 2 })
    .getByRole("link")
    .click();
  await page.getByRole("button", { name: "Call via +8809610000001" }).click();
  await expect(page.getByText("Your phone is ringing", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open call" }).first()).toBeVisible({ timeout: 15_000 });
});

test("the power dialer calls the next lead in the queue", async ({ page }) => {
  await page.goto("/en/calls?view=dialer");
  await expect(page.getByText(/leads? to call/)).toBeVisible();
  await page.getByRole("button", { name: "Call", exact: true }).click();
  await expect(page.getByText("Ringing")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next lead" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Connected")).toBeVisible();
});

test("managers see per-agent coaching", async ({ page }) => {
  await page.goto("/en/calls?view=coaching");
  await expect(page.getByRole("columnheader", { name: "Talk ratio" })).toBeVisible();
  await expect(page.getByText("price too high · 5")).toBeVisible();
});

test("a PBX number shows the webhook to paste into the PBX", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.getByRole("link", { name: "Channels" }).click();
  await expect(page.getByText("+8809610000001")).toBeVisible();
  await page.getByRole("button", { name: "Add number" }).click();
  await page.getByLabel("Number").fill("09612000777");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Number connected")).toBeVisible();
  await expect(page.getByText("/v1/webhooks/voice/pbx/", { exact: false })).toBeVisible();
});

test("recording needs a notice, and agents set the phone they answer on", async ({ page }) => {
  await page.goto("/en/settings/calls");
  await expect(page.getByLabel("Phone you answer calls on")).toHaveValue("+8801711000099");
  const notice = page.getByLabel("Notice played to the lead");
  await expect(notice).toHaveValue("This call may be recorded for quality.");
  await page.getByLabel("Keep recordings for (days)").fill("30");
  await page.getByRole("button", { name: "Save" }).last().click();
  await expect(page.getByText("Saved").first()).toBeVisible();
});
