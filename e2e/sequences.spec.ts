import { expect, test } from "@playwright/test";

// FRONTEND_PROMPT 17.3: recovery sequences — the grouped sidebar, the step-list editor with a live preview, the
// monitor with recovered revenue vs. holdout, a lead's sequence, and the dashboard hero card.

test("the sidebar is grouped and Sequences sits under Automation", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop sidebar");
  await page.goto("/en/inbox");
  const nav = page.getByRole("navigation", { name: "Main navigation" }).first();
  for (const g of ["Work", "Automation", "Insights", "Manage"]) {
    await expect(nav.getByRole("group", { name: g })).toBeVisible();
  }
  await nav.getByRole("group", { name: "Automation" }).getByRole("link", { name: "Sequences" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Recovery sequences" })).toBeVisible();
});

test("the list shows recovered revenue against the holdout", async ({ page }) => {
  await page.goto("/en/sequences");
  await expect(page.getByText("No answer twice → WhatsApp")).toBeVisible();
  await expect(page.getByText("vs. holdout", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("2 unanswered calls", { exact: false })).toBeVisible();
});

test("build a sequence: preview who matches, add steps, create and activate", async ({ page }) => {
  await page.goto("/en/sequences/new");
  await page.getByLabel("Name", { exact: true }).fill("Gone quiet 7 days");
  await page.getByRole("radio", { name: "Gone quiet" }).click();
  await expect(page.getByText(/leads? match now/)).toBeVisible();
  await page.getByRole("button", { name: "SMS", exact: true }).click();
  await page.getByLabel("Message").last().fill("Hi {first_name}, still thinking about it? Reply STOP to opt out.");
  // The template step needs a template: pick the approved one.
  await page.getByLabel("Approved template").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create as draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gone quiet 7 days" })).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("Sequence is running")).toBeVisible();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
});

test("a sequence can't end with a wait", async ({ page }) => {
  await page.goto("/en/sequences/new");
  await page.getByLabel("Name", { exact: true }).fill("Only waiting");
  for (const n of [3, 2, 1]) await page.getByRole("button", { name: `Remove step ${n}` }).click();
  await page.getByRole("button", { name: "Wait", exact: true }).click();
  await page.getByRole("button", { name: "Create as draft" }).click();
  await expect(page.getByText("Add at least one step that does something", { exact: false })).toBeVisible();
});

test("the monitor shows the funnel and exits; a lead's sequence can be stopped", async ({ page }) => {
  await page.goto("/en/sequences");
  await page.getByRole("link", { name: "No answer twice → WhatsApp" }).click();
  await expect(page.getByText("150 done · 12 skipped · 0 failed")).toBeVisible();
  await expect(page.getByText("no consent for this channel (12)").first()).toBeVisible();
  await expect(page.getByText("Replied · 31")).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "In progress" }).getByRole("link").click();
  const card = page.getByRole("region", { name: "Recovery sequence" });
  await expect(card.getByText("step 2 of 3", { exact: false })).toBeVisible();
  await card.getByRole("button", { name: "Stop sequence" }).click();
  await expect(page.getByText("Sequence stopped")).toBeVisible();
});

test("the dashboard leads with recovered revenue", async ({ page }) => {
  await page.goto("/en/dashboard");
  await expect(page.getByText("Recovered revenue · last 90 days")).toBeVisible();
  await expect(page.getByText("Holdout: 1 of 21 bought anyway", { exact: false })).toBeVisible();
});
