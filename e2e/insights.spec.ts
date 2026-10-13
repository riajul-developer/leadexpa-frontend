import { expect, test } from "@playwright/test";

// FRONTEND_PROMPT 17.10 + 17.11 (step 7b): client health with components and an anomaly timeline, an AI draft
// update, the agency's clients by health, attribution with a model switcher that labels every number, and the
// forecast's range chart with the weighted pipeline.

test("client health: score, components, anomaly timeline and a drafted update", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Bashundhara Homes" }).first().click();
  await page.getByRole("link", { name: "Health", exact: true }).click();
  await expect(page.getByRole("img", { name: /Health 54 out of 100: Watch/ })).toBeVisible();
  await expect(page.locator('[data-component="volume"]')).toContainText("Lead volume");
  await expect(page.getByText(/Lead volume dropped 86% on .+ — Eid offer paused\?/)).toBeVisible();

  await page.getByRole("button", { name: "Draft a client update" }).click();
  const dialog = page.getByRole("dialog", { name: "Update for Bashundhara Homes" });
  await expect(dialog.getByLabel("Subject")).toHaveValue(/leads dipped/);
  await expect(dialog.getByLabel("Message")).toHaveValue(/Eid offer/);
  await dialog.getByRole("button", { name: "Done" }).click();
});

test("insights: clients by health, attribution models and the forecast", async ({ page }) => {
  await page.goto("/en/insights");
  await expect(page.getByRole("heading", { name: "Insights", level: 1 })).toBeVisible();
  const rows = page.locator("[data-client]");
  await expect(rows.first()).toHaveAttribute("data-client", "Aarong Style House");
  await expect(rows.first().getByText(/issue/)).toBeVisible();

  await page.getByRole("tab", { name: "Attribution" }).click();
  await expect(page.locator("[data-model-label]")).toHaveText("Model: Linear");
  await expect(page.getByRole("columnheader", { name: "Revenue (Linear)" })).toBeVisible();
  await page.getByLabel("Attribution model").selectOption("first_touch");
  await expect(page.locator("[data-model-label]")).toHaveText("Model: First touch");
  await expect(page.getByText("All credit goes to the first touchpoint", { exact: false })).toBeVisible();
  await expect(page.locator('[data-row="Implant offer"]')).toBeVisible();

  await page.getByRole("tab", { name: "Forecast" }).click();
  await expect(page.locator('[data-forecast="4w"]')).toContainText("most likely");
  await expect(page.getByRole("heading", { name: "Weighted pipeline" })).toBeVisible();
  await expect(page.locator('[data-stage="qualified"]')).toContainText("52%");
});
